import Foundation

private let rules: [(RE, String)] = [
  (RE(#"\b(SALARY|SAL CREDIT|PAYROLL)\b"#, .caseInsensitive), "income"),
  (RE(#"\b(INTEREST|INT\.?PD|INT CREDIT|DIVIDEND|CASHBACK)\b"#, .caseInsensitive), "income"),
  (RE(#"\b(CREDIT CARD|CC BILL|CARD BILL|CARD PAYMENT|PAYMENT RECEIVED|AUTOPAY THANK|BBPS)\b"#, .caseInsensitive), "transfers"),
  (RE(#"\b(SIP|MUTUAL FUND|MF |AMC|BSE STAR|NSE MF|ZERODHA|GROWW|COIN BY|KUVERA|NACH.*(MF|FUND))\b"#, .caseInsensitive), "investments"),
  (RE(#"\b(EMI|LOAN|NBFC|BAJAJ FIN)\b"#, .caseInsensitive), "emi"),
  (RE(#"\b(RENT|LANDLORD|NOBROKER|HOUSING)\b"#, .caseInsensitive), "rent"),
  (RE(#"\b(INSURANCE|LIC |PREMIUM|POLICY)\b"#, .caseInsensitive), "insurance"),
  (RE(#"\b(SWIGGY|ZOMATO|RESTAURANT|CAFE|DOSA|BIRYANI|CHAI|DOMINOS|PIZZA|STARBUCKS|EATCLUB|FOOD)\b"#, .caseInsensitive), "dining"),
  (RE(#"\b(BIGBASKET|BLINKIT|ZEPTO|INSTAMART|DMART|GROCER|KIRANA|MORE RETAIL|RELIANCE FRESH|NATURES BASKET|ORGANIC)\b"#, .caseInsensitive), "groceries"),
  (RE(#"\b(UBER|OLA|RAPIDO|METRO|IRCTC|AUTO RIDE|CAB|FASTAG|PARKING)\b"#, .caseInsensitive), "transport"),
  (RE(#"\b(PETROL|FUEL|HPCL|BPCL|IOCL|INDIAN OIL|SHELL)\b"#, .caseInsensitive), "fuel"),
  (RE(#"\b(AIRTEL|JIO|VODAFONE|\bVI\b|BESCOM|ELECTRICITY|POWER|BROADBAND|WATER|GAS|RECHARGE|BILLDESK)\b"#, .caseInsensitive), "utilities"),
  (RE(#"\b(NETFLIX|SPOTIFY|PRIME|HOTSTAR|YOUTUBE|APPLE\.COM|GOOGLE ?PLAY|ICLOUD|SUBSCRIPTION|STREAM)\b"#, .caseInsensitive), "subscriptions"),
  (RE(#"\b(PHARMA|PHARMACY|APOLLO|HOSPITAL|CLINIC|MEDICAL|1MG|NETMEDS|PRACTO|DIAGNOSTIC)\b"#, .caseInsensitive), "health"),
  (RE(#"\b(MAKEMYTRIP|GOIBIBO|CLEARTRIP|INDIGO|AIR INDIA|VISTARA|HOTEL|OYO|AIRBNB|RAIL)\b"#, .caseInsensitive), "travel"),
  (RE(#"\b(PVR|INOX|BOOKMYSHOW|CINEMA|CONCERT|GAMING)\b"#, .caseInsensitive), "entertainment"),
  (RE(#"\b(SCHOOL|COLLEGE|UNIVERSITY|COURSE|UDEMY|COURSERA|TUITION|FEES? PAYMENT)\b"#, .caseInsensitive), "education"),
  (RE(#"\b(AMAZON|FLIPKART|MYNTRA|AJIO|NYKAA|MEESHO|TATA CLIQ|CROMA|DECATHLON|IKEA|BAZAAR|FASHION|MALL)\b"#, .caseInsensitive), "shopping"),
  (RE(#"\b(ATM|CASH WDL|CASH WITHDRAWAL|CWDR|NWD)\b"#, .caseInsensitive), "cash"),
  (RE(#"\b(CHARGES|CHGS|FEE|GST|PENALTY|LATE PAYMENT|FINANCE CHARGE|ANNUAL FEE)\b"#, .caseInsensitive), "fees"),
  (RE(#"\b(SELF TRANSFER|OWN ACCOUNT|SWEEP|FD BOOKED|TRANSFER TO|TRF TO|TO SELF)\b"#, .caseInsensitive), "transfers"),
]

func categorise(_ description: String, _ amount: Int) -> String {
  for (pattern, category) in rules where pattern.test(description) {
    if category == "income", amount < 0 { continue }
    return category
  }
  return amount > 0 ? "income" : "other"
}

func detectMethod(_ description: String, fallback: String = "other") -> String {
  let text = description.uppercased()
  if RE(#"\bUPI\b|UPI/"#).test(text) { return "upi" }
  if RE(#"\bNEFT\b"#).test(text) { return "neft" }
  if RE(#"\bIMPS\b"#).test(text) { return "imps" }
  if RE(#"\b(NACH|ECS|ACH|AUTOPAY|SI-|STANDING INSTRUCTION|AUTO DEBIT)\b"#).test(text) { return "autodebit" }
  if RE(#"\b(ATM|CASH)\b"#).test(text) { return "cash" }
  if RE(#"\b(POS|CARD)\b"#).test(text) { return "card" }
  if RE(#"\b(NETBANKING|NET BANKING|IB |BILLPAY|RTGS)\b"#).test(text) { return "netbanking" }
  return fallback
}

private let longToken = RE(#"\b[0-9X]{6,}\b"#, .caseInsensitive)
private let channelPrefix = RE(#"^(UPI|POS|ECOM|NEFT|IMPS|RTGS|ACH|NACH|BIL|ONL|ATM WDL|ATM)(\s*(CR|DR|D|C))?[\s/:-]+"#, .caseInsensitive)
private let partyPrefix = RE(#"^(P2M|P2A|DR|CR)[/-]"#, .caseInsensitive)
private let merchantSplit = RE(#"[/@*]|-(?=\S)| {2,}"#)
private let trailingPunctuation = RE(#"[\s\-/.:,]+$"#)
private let wordStart = RE(#"\b[a-z]"#)
private let letters3 = RE(#"[A-Za-z]{3}"#)

func guessMerchant(_ description: String) -> String? {
  var text = description.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    .trimmingCharacters(in: .whitespacesAndNewlines)
  text = longToken.replacingAll(in: text) { _ in " " }
  text = channelPrefix.replacingFirst(in: text, with: "")
  text = partyPrefix.replacingFirst(in: text, with: "")
  text = text.trimmingCharacters(in: .whitespacesAndNewlines)
  let first = splitMatches(text, merchantSplit).first?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  guard !first.isEmpty, letters3.test(first) else { return nil }
  return tidy(first)
}

private func tidy(_ text: String) -> String {
  var value = text.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
  value = trailingPunctuation.replacingFirst(in: value, with: "")
  value = value.trimmingCharacters(in: .whitespacesAndNewlines)
  value = String(value.prefix(80)).lowercased()
  return wordStart.replacingAll(in: value) { $0.uppercased() }
}

private func splitMatches(_ text: String, _ pattern: RE) -> [String] {
  let ns = text as NSString
  let range = NSRange(location: 0, length: ns.length)
  var parts: [String] = []
  var cursor = 0
  for found in pattern.regex.matches(in: text, options: [], range: range) {
    parts.append(ns.substring(with: NSRange(location: cursor, length: found.range.location - cursor)))
    cursor = found.range.location + found.range.length
  }
  parts.append(ns.substring(from: cursor))
  return parts
}
