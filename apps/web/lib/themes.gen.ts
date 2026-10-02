/* Generated — do not edit. Source: docs/themes.json */

export const themes = [
  {
    id: "lakshmi",
    name: "Lakshmi",
    premium: false,
    description: "Indigo, gold and lotus. Your original Lakshly.",
    usesSemanticIcons: false,
    spacious: false,
    clearGlass: false,
    swatches: {
      light: { bg: "#FBF8F1", surface: "#F5F4F9", text: "#19213E", gold: "#765510", income: "#087852", spend: "#AB443E", invest: "#087B80", accent: "#C24D72" },
      dark: { bg: "#0E1430", surface: "#1A2344", text: "#F3F4FC", gold: "#E9BF62", income: "#63D4AA", spend: "#F6ADA4", invest: "#6CCED2", accent: "#E8789A" },
    },
  },
  {
    id: "monochromeGold",
    name: "Monochrome Gold",
    premium: false,
    description: "Quiet neutrals, clear glass and a single gold hue.",
    usesSemanticIcons: true,
    spacious: true,
    clearGlass: true,
    swatches: {
      light: { bg: "#FFFFFF", surface: "#F5F5F5", text: "#111111", gold: "#806000", income: "#383838", spend: "#595959", invest: "#6A6A6A", accent: "#806000" },
      dark: { bg: "#000000", surface: "#161616", text: "#FFFFFF", gold: "#D9AF52", income: "#E5E5E5", spend: "#BDBDBD", invest: "#999999", accent: "#D9AF52" },
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    premium: false,
    description: "Apple greys with a crisp blue accent.",
    usesSemanticIcons: false,
    spacious: false,
    clearGlass: false,
    swatches: {
      light: { bg: "#F5F5F7", surface: "#FFFFFF", text: "#171719", gold: "#0066CC", income: "#236542", spend: "#9C4141", invest: "#365D89", accent: "#0066CC" },
      dark: { bg: "#111113", surface: "#1C1C1E", text: "#F5F5F7", gold: "#0A84FF", income: "#85CEA3", spend: "#EAA39D", invest: "#90B8EE", accent: "#0A84FF" },
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    premium: true,
    description: "Deep navy with tidal teal and warm light.",
    usesSemanticIcons: false,
    spacious: false,
    clearGlass: false,
    swatches: {
      light: { bg: "#F1F8FA", surface: "#FFFFFF", text: "#122F43", gold: "#176575", income: "#18684B", spend: "#A44342", invest: "#245E9A", accent: "#247982" },
      dark: { bg: "#081B2B", surface: "#102D3E", text: "#ECF7FA", gold: "#71CCD5", income: "#7CD5AA", spend: "#F0A092", invest: "#8FBCEB", accent: "#76D8C7" },
    },
  },
  {
    id: "forest",
    name: "Forest",
    premium: true,
    description: "Deep evergreen and soft sand accents.",
    usesSemanticIcons: false,
    spacious: false,
    clearGlass: false,
    swatches: {
      light: { bg: "#F7F8F0", surface: "#FFFFFF", text: "#1E3023", gold: "#75602A", income: "#25643B", spend: "#9C4939", invest: "#2D6271", accent: "#647742" },
      dark: { bg: "#101F18", surface: "#1C3024", text: "#F1F6EC", gold: "#E0C38C", income: "#85D5A3", spend: "#ECAF9E", invest: "#91C7D5", accent: "#B5CE87" },
    },
  },
  {
    id: "roseQuartz",
    name: "Rose Quartz",
    premium: true,
    description: "Blush ivory and plum, softened with rose.",
    usesSemanticIcons: false,
    spacious: false,
    clearGlass: false,
    swatches: {
      light: { bg: "#FCF5F3", surface: "#FFFFFF", text: "#382332", gold: "#7C416E", income: "#286746", spend: "#A54153", invest: "#4E5995", accent: "#AD4C72" },
      dark: { bg: "#251323", surface: "#392035", text: "#FCF0F8", gold: "#E8B4D4", income: "#97D3AE", spend: "#F4A3AD", invest: "#B9BAEF", accent: "#EB91B6" },
    },
  },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

export const themeBootScript = "/* Theme boot. ?theme=<id>&appearance=light|dark applies for this load only. ?switcher=open opens the switcher. */(function(){try{var IDS=[\"lakshmi\",\"monochromeGold\",\"graphite\",\"ocean\",\"forest\",\"roseQuartz\"];var PREMIUM={\"ocean\":1,\"forest\":1,\"roseQuartz\":1};var FLAGS={\"lakshmi\":{\"semantic\":false,\"spacious\":false,\"clear\":false},\"monochromeGold\":{\"semantic\":true,\"spacious\":true,\"clear\":true},\"graphite\":{\"semantic\":false,\"spacious\":false,\"clear\":false},\"ocean\":{\"semantic\":false,\"spacious\":false,\"clear\":false},\"forest\":{\"semantic\":false,\"spacious\":false,\"clear\":false},\"roseQuartz\":{\"semantic\":false,\"spacious\":false,\"clear\":false}};var BGS={\"lakshmi\":{\"light\":\"#FBF8F1\",\"dark\":\"#0E1430\"},\"monochromeGold\":{\"light\":\"#FFFFFF\",\"dark\":\"#000000\"},\"graphite\":{\"light\":\"#F5F5F7\",\"dark\":\"#111113\"},\"ocean\":{\"light\":\"#F1F8FA\",\"dark\":\"#081B2B\"},\"forest\":{\"light\":\"#F7F8F0\",\"dark\":\"#101F18\"},\"roseQuartz\":{\"light\":\"#FCF5F3\",\"dark\":\"#251323\"}};var root=document.documentElement;var params=new URLSearchParams(location.search);var qTheme=params.get(\"theme\");var qAppearance=params.get(\"appearance\");var qSwitcher=params.get(\"switcher\");var plan=\"free\";try{if(localStorage.getItem(\"lakshly.plan\")===\"premium\")plan=\"premium\"}catch(e){}var appearance=\"system\";try{var storedAppearance=localStorage.getItem(\"lakshly.appearance\");var legacy=localStorage.getItem(\"lakshly.theme\");if(storedAppearance===\"light\"||storedAppearance===\"dark\"||storedAppearance===\"system\")appearance=storedAppearance;else if(legacy===\"light\"||legacy===\"dark\"){appearance=legacy;try{localStorage.setItem(\"lakshly.appearance\",legacy);localStorage.removeItem(\"lakshly.theme\")}catch(e){}}}catch(e){}var theme=\"lakshmi\";try{var storedTheme=localStorage.getItem(\"lakshly.themeId\");if(storedTheme&&IDS.indexOf(storedTheme)!==-1)theme=storedTheme}catch(e){}var ephemeralTheme=false;if(qTheme&&IDS.indexOf(qTheme)!==-1){theme=qTheme;ephemeralTheme=true}if(!ephemeralTheme&&PREMIUM[theme]&&plan!==\"premium\")theme=\"lakshmi\";var ephemeralAppearance=\"\";if(qAppearance===\"light\"||qAppearance===\"dark\")ephemeralAppearance=qAppearance;var resolved;if(ephemeralAppearance)resolved=ephemeralAppearance;else if(appearance===\"light\"||appearance===\"dark\")resolved=appearance;else{try{resolved=matchMedia(\"(prefers-color-scheme: dark)\").matches?\"dark\":\"light\"}catch(e){resolved=\"light\"}}var flags=FLAGS[theme]||FLAGS.lakshmi;root.dataset.theme=theme;root.dataset.appearance=resolved;root.dataset.semanticIcons=flags.semantic?\"true\":\"false\";root.dataset.spacious=flags.spacious?\"true\":\"false\";root.dataset.clearGlass=flags.clear?\"true\":\"false\";if(ephemeralTheme)root.dataset.themeEphemeral=\"1\";if(ephemeralAppearance)root.dataset.appearanceEphemeral=ephemeralAppearance;if(qSwitcher===\"open\")root.dataset.switcher=\"open\";var bg=(BGS[theme]&&BGS[theme][resolved])||(BGS.lakshmi&&BGS.lakshmi.light)||\"#FBF8F1\";var metas=document.querySelectorAll('meta[name=\"theme-color\"]');if(!metas.length){var meta=document.createElement(\"meta\");meta.setAttribute(\"name\",\"theme-color\");meta.setAttribute(\"content\",bg);if(document.head)document.head.appendChild(meta)}else{for(var i=0;i<metas.length;i++){metas[i].setAttribute(\"content\",bg);metas[i].removeAttribute(\"media\")}}}catch(e){}})();";
