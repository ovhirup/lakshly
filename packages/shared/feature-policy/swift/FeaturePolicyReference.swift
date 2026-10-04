import Foundation
import CoreFoundation

// Authored semantics matching C1. Schema generation does not establish authority or access rules.
extension LakshlyFeaturePolicyV1 {
  public struct ValidationIssue: Equatable {
    public let path: String
    public let code: String
  }

  private static func check(_ condition: Bool, _ path: String, _ code: String,
                            _ issues: inout [ValidationIssue]) {
    if !condition { issues.append(ValidationIssue(path: path, code: code)) }
  }

  private static func object(_ value: Any?, keys: [String], path: String,
                             issues: inout [ValidationIssue]) -> [String: Any]? {
    guard let value = value as? [String: Any] else {
      issues.append(ValidationIssue(path: path, code: "object_required")); return nil
    }
    for key in keys where value[key] == nil {
      issues.append(ValidationIssue(path: "\(path)/\(key)", code: "required"))
    }
    for key in value.keys.sorted() where !keys.contains(key) {
      issues.append(ValidationIssue(path: path, code: "additional_property"))
    }
    return value
  }

  private static func member(_ value: Any?, _ values: [String], _ path: String,
                             _ issues: inout [ValidationIssue]) {
    check((value as? String).map(values.contains) ?? false, path, "enum", &issues)
  }

  private static func isNull(_ value: Any?) -> Bool { value is NSNull }
  private static func isBoolean(_ value: Any?) -> Bool {
    guard let number = value as? NSNumber else { return false }
    return CFGetTypeID(number) == CFBooleanGetTypeID()
  }

  // JSON's numeric domain is the parsed JavaScript Double domain, not arbitrary decimal precision.
  private static func integer(_ value: Any?, minimum: Int64 = minimumQuantity,
                              maximum: Int64 = maximumQuantity) -> Int64? {
    guard let number = value as? NSNumber, !isBoolean(value) else { return nil }
    let parsed = number.doubleValue
    guard parsed.isFinite, parsed.rounded(.towardZero) == parsed,
          parsed >= Double(minimum), parsed <= Double(maximum) else { return nil }
    return Int64(parsed)
  }

  private static func identifier(_ value: Any?) -> String? {
    guard let value = value as? String,
          value.utf16.count >= identifierMinimumLength,
          value.utf16.count <= identifierMaximumLength else { return nil }
    let bytes = Array(value.utf8)
    guard let first = bytes.first, first >= 97 && first <= 122 else { return nil }
    guard bytes.dropFirst().allSatisfy({ byte in
      (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122)
        || (byte >= 48 && byte <= 57) || byte == 46 || byte == 95 || byte == 45
    }) else { return nil }
    return value
  }

  private static func combination(_ suite: Any?, _ channel: Any?) -> Bool {
    let suite = suite as? String, channel = channel as? String
    return (suite == "public" && (channel == "beta" || channel == "stable"))
      || (suite == "private" && channel == "experimental")
  }

  public static func validateCatalog(_ value: Any?) -> [ValidationIssue] {
    var issues: [ValidationIssue] = []
    guard let catalog = object(value, keys: catalogRequiredKeys, path: "", issues: &issues) else { return issues }
    check(integer(catalog["policyVersion"]) == policyVersion, "/policyVersion", "version", &issues)
    check(identifier(catalog["policyRevision"]) != nil, "/policyRevision", "identifier", &issues)
    guard let features = catalog["features"] as? [Any] else {
      issues.append(ValidationIssue(path: "/features", code: "array_required")); return issues
    }
    var ids = Set<String>()
    for (index, value) in features.enumerated() {
      let path = "/features/\(index)"
      guard let feature = object(value, keys: featureRequiredKeys, path: path, issues: &issues) else { continue }
      check(identifier(feature["id"]) != nil, "\(path)/id", "identifier", &issues)
      if let id = feature["id"] as? String {
        check(!ids.contains(id), "\(path)/id", "duplicate_feature", &issues); ids.insert(id)
      }
      member(feature["audience"], suiteValues, "\(path)/audience", &issues)
      check(isBoolean(feature["implemented"]), "\(path)/implemented", "boolean", &issues)
      check(isBoolean(feature["enabled"]), "\(path)/enabled", "boolean", &issues)
      member(feature["minimumPublicTier"], publicTierValues, "\(path)/minimumPublicTier", &issues)
      let supported = feature["supportedPlatforms"] as? [Any]
      if let supported {
        var seen = Set<String>()
        for (index, platform) in supported.enumerated() {
          member(platform, platformValues, "\(path)/supportedPlatforms/\(index)", &issues)
          if let platform = platform as? String {
            check(!seen.contains(platform), "\(path)/supportedPlatforms/\(index)", "duplicate_platform", &issues)
            seen.insert(platform)
          }
        }
      } else { issues.append(ValidationIssue(path: "\(path)/supportedPlatforms", code: "array_required")) }
      if let available = feature["availableIn"] as? [Any] {
        var triples = Set<[String]>()
        for (index, item) in available.enumerated() {
          let ap = "\(path)/availableIn/\(index)"
          guard let item = object(item, keys: availabilityRequiredKeys, path: ap, issues: &issues) else { continue }
          member(item["suite"], suiteValues, "\(ap)/suite", &issues)
          member(item["channel"], channelValues, "\(ap)/channel", &issues)
          member(item["platform"], platformValues, "\(ap)/platform", &issues)
          check(combination(item["suite"], item["channel"]), ap, "suite_channel", &issues)
          check(feature["audience"] as? String != "private" || item["suite"] as? String != "public", ap, "private_audience", &issues)
          check(supported?.contains(where: { ($0 as? String) != nil && ($0 as? String) == (item["platform"] as? String) }) ?? false,
                "\(ap)/platform", "unsupported_reference", &issues)
          if let suite = item["suite"] as? String, let channel = item["channel"] as? String,
             let platform = item["platform"] as? String {
            let triple = [suite, channel, platform]
            check(!triples.contains(triple), ap, "duplicate_availability", &issues); triples.insert(triple)
          }
        }
      } else { issues.append(ValidationIssue(path: "\(path)/availableIn", code: "array_required")) }
      if !isNull(feature["quota"]),
         let quota = object(feature["quota"], keys: featureQuotaRequiredKeys, path: "\(path)/quota", issues: &issues) {
        for tier in featureQuotaRequiredKeys {
          check(isNull(quota[tier]) || integer(quota[tier]) != nil, "\(path)/quota/\(tier)", "safe_quantity", &issues)
        }
      }
    }
    return issues
  }

  public static func validateContext(_ value: Any?) -> [ValidationIssue] {
    var issues: [ValidationIssue] = []
    guard let context = object(value, keys: contextRequiredKeys, path: "", issues: &issues) else { return issues }
    check(integer(context["policyVersion"]) == policyVersion, "/policyVersion", "version", &issues)
    member(context["suite"], suiteValues, "/suite", &issues)
    member(context["channel"], channelValues, "/channel", &issues)
    member(context["platform"], platformValues, "/platform", &issues)
    check(combination(context["suite"], context["channel"]), "", "suite_channel", &issues)
    check(integer(context["asOfEpochSeconds"], minimum: minimumEpochSeconds, maximum: maximumEpochSeconds) != nil, "/asOfEpochSeconds", "epoch_seconds", &issues)
    guard let entitlement = object(context["entitlement"], keys: entitlementRequiredKeys, path: "/entitlement", issues: &issues) else { return issues }
    member(entitlement["kind"], entitlementKindValues, "/entitlement/kind", &issues)
    member(entitlement["provenance"], provenanceValues, "/entitlement/provenance", &issues)
    member(entitlement["state"], entitlementStateValues, "/entitlement/state", &issues)
    for bound in ["startsAtEpochSeconds", "endsAtEpochSeconds"] {
      check(isNull(entitlement[bound]) || integer(entitlement[bound], minimum: minimumEpochSeconds, maximum: maximumEpochSeconds) != nil,
            "/entitlement/\(bound)", "epoch_seconds", &issues)
    }
    let suite = context["suite"] as? String, channel = context["channel"] as? String
    let kind = entitlement["kind"] as? String, provenance = entitlement["provenance"] as? String,
        state = entitlement["state"] as? String
    let start = integer(entitlement["startsAtEpochSeconds"], minimum: minimumEpochSeconds, maximum: maximumEpochSeconds)
    let none = kind == "none" && provenance == "none" && state == "none"
      && isNull(entitlement["startsAtEpochSeconds"]) && isNull(entitlement["endsAtEpochSeconds"])
    let premium = suite == "public" && kind == "premium"
      && (provenance == "verifiedEntitlement" || (provenance == "betaSimulation" && channel == "beta"))
      && (state == "active" || state == "revoked" || state == "refunded") && start != nil
    let superUser = suite == "private" && kind == "superUser" && provenance == "verifiedPrivateAuthorization"
      && (state == "active" || state == "revoked") && start != nil
    check(none || premium || superUser, "/entitlement", "entitlement_combination", &issues)
    if !isNull(entitlement["endsAtEpochSeconds"]) {
      let end = integer(entitlement["endsAtEpochSeconds"], minimum: minimumEpochSeconds, maximum: maximumEpochSeconds)
      check(start != nil && end != nil && end! > start!, "/entitlement", "interval_order", &issues)
    }
    return issues
  }

  public static func validateRequest(_ value: Any?) -> [ValidationIssue] {
    var issues: [ValidationIssue] = []
    guard let request = object(value, keys: requestRequiredKeys, path: "", issues: &issues) else { return issues }
    check(identifier(request["featureId"]) != nil, "/featureId", "identifier", &issues)
    if let usage = object(request["usage"], keys: requestUsageRequiredKeys, path: "/usage", issues: &issues) {
      check(integer(usage["used"]) != nil, "/usage/used", "safe_quantity", &issues)
      check(integer(usage["requested"], minimum: minimumRequested) != nil, "/usage/requested", "positive_safe_quantity", &issues)
    }
    return issues
  }

  public static func evaluateFeaturePolicy(catalog: Any?, context: Any?, request: Any?) -> Decision {
    let featureId = identifier((request as? [String: Any])?["featureId"]) ?? ""
    func decision(_ reason: Reason, _ revision: String?, _ tier: Tier? = nil,
                  _ basis: AccessBasis? = nil, _ limit: Int64? = nil) -> Decision {
      Decision(policyVersion: policyVersion, policyRevision: revision, featureId: featureId,
               allowed: reason == .allowed, reason: reason, effectiveTier: tier, accessBasis: basis, limit: limit)
    }
    guard validateCatalog(catalog).isEmpty else { return decision(.invalid_catalog, nil) }
    let catalog = catalog as! [String: Any]
    let revision = catalog["policyRevision"] as! String
    guard validateContext(context).isEmpty else { return decision(.invalid_context, revision) }
    guard validateRequest(request).isEmpty else { return decision(.invalid_request, revision) }
    let context = context as! [String: Any], request = request as! [String: Any]
    let features = catalog["features"] as! [[String: Any]]
    guard let feature = features.first(where: { $0["id"] as? String == featureId }) else { return decision(.unknown_feature, revision) }
    let suite = context["suite"] as! String, channel = context["channel"] as! String, platform = context["platform"] as! String
    if suite == "public" && feature["audience"] as! String == "private" { return decision(.private_feature, revision) }
    if !(feature["implemented"] as! NSNumber).boolValue { return decision(.not_implemented, revision) }
    if !(feature["enabled"] as! NSNumber).boolValue { return decision(.disabled, revision) }
    if !(feature["supportedPlatforms"] as! [String]).contains(platform) { return decision(.unsupported_platform, revision) }
    if !(feature["availableIn"] as! [[String: Any]]).contains(where: {
      $0["suite"] as? String == suite && $0["channel"] as? String == channel && $0["platform"] as? String == platform
    }) { return decision(.channel_unavailable, revision) }
    let entitlement = context["entitlement"] as! [String: Any]
    let now = integer(context["asOfEpochSeconds"], minimum: minimumEpochSeconds, maximum: maximumEpochSeconds)!
    let start = integer(entitlement["startsAtEpochSeconds"], minimum: minimumEpochSeconds, maximum: maximumEpochSeconds)
    let end = integer(entitlement["endsAtEpochSeconds"], minimum: minimumEpochSeconds, maximum: maximumEpochSeconds)
    let active = entitlement["state"] as? String == "active" && start != nil && start! <= now
      && (isNull(entitlement["endsAtEpochSeconds"]) || (end != nil && now < end!))
    var tier: Tier = .free, basis: AccessBasis = .free
    if suite == "private" {
      guard active && entitlement["kind"] as? String == "superUser" else { return decision(.private_authorization_required, revision) }
      tier = .superUser; basis = .privateSuperUser
    } else if active && entitlement["kind"] as? String == "premium" {
      tier = .premium; basis = entitlement["provenance"] as? String == "betaSimulation" ? .simulatedPremium : .verifiedPremium
    }
    if tier == .free && feature["minimumPublicTier"] as? String == "premium" { return decision(.tier_required, revision, tier, basis) }
    var limit: Int64?
    if tier != .superUser, let quota = feature["quota"] as? [String: Any] {
      limit = integer(quota[tier.rawValue])
    }
    let usage = request["usage"] as! [String: Any]
    let used = integer(usage["used"])!, requested = integer(usage["requested"], minimum: minimumRequested)!
    if let limit, requested > limit || used > limit - requested { return decision(.quota_exhausted, revision, tier, basis, limit) }
    return decision(.allowed, revision, tier, basis, limit)
  }
}
