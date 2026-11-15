// מחלקות הסופר, לפי סדר הליכה טיפוסי בחנות
export const CATEGORIES = [
  { id: 'ירקות ופירות', emoji: '🥬' },
  { id: 'לחם ומאפים', emoji: '🍞' },
  { id: 'חלב וביצים', emoji: '🥛' },
  { id: 'בשר עוף ודגים', emoji: '🍗' },
  { id: 'מעדנייה', emoji: '🧀' },
  { id: 'קפואים', emoji: '🧊' },
  { id: 'יבשים ובישול', emoji: '🍝' },
  { id: 'שימורים ורטבים', emoji: '🥫' },
  { id: 'ארוחת בוקר', emoji: '🥣' },
  { id: 'חטיפים ומתוקים', emoji: '🍫' },
  { id: 'משקאות', emoji: '🥤' },
  { id: 'ניקיון', emoji: '🧽' },
  { id: 'פארם והיגיינה', emoji: '🧴' },
  { id: 'תינוקות', emoji: '🍼' },
  { id: 'בית וחד"פ', emoji: '🏠' },
  { id: 'אחר', emoji: '🛒' },
];

export const CAT_ORDER = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]));
export const CAT_EMOJI = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.emoji]));

// מילון: מילת מפתח | אימוג'י | מונח באנגלית לחיפוש תמונה
// התאמה לפי "השם מכיל את המילה", המילה הארוכה ביותר מנצחת.
const RAW = {
  'ירקות ופירות': `עגבניות שרי|🍅|cherry tomatoes;עגבני|🍅|tomatoes;מלפפון|🥒|cucumbers;מלפפונים|🥒|cucumbers;בצל ירוק|🧅|green onion;בצל|🧅|onions;שום|🧄|garlic;תפוחי אדמה|🥔|potatoes;תפו"א|🥔|potatoes;תפוא|🥔|potatoes;בטטה|🍠|sweet potato;גזר|🥕|carrots;פלפל|🫑|bell pepper;חסה|🥬|lettuce;כרוב|🥬|cabbage;ברוקולי|🥦|broccoli;כרובית|🥦|cauliflower;קישוא|🥒|zucchini;חציל|🍆|eggplant;פטריות|🍄|mushrooms;תירס|🌽|corn;אבוקדו|🥑|avocado;לימון|🍋|lemon;תפוח|🍎|apples;תפוחים|🍎|apples;בננ|🍌|bananas;תפוז|🍊|oranges;קלמנטינ|🍊|clementines;אגס|🍐|pears;ענבים|🍇|grapes;אבטיח|🍉|watermelon;מלון|🍈|melon;תות|🍓|strawberries;אפרסק|🍑|peaches;שזיפ|🍑|plums;מנגו|🥭|mango;אננס|🍍|pineapple;קיווי|🥝|kiwi;רימון|🍎|pomegranate;פטרוזיליה|🌿|parsley;כוסברה|🌿|cilantro;שמיר|🌿|dill;נענע|🌿|mint;סלרי|🥬|celery;סלק|🍠|beetroot;צנון|🥕|radish;דלעת|🎃|pumpkin;ג'ינג'ר|🫚|ginger;ירקות|🥬|vegetables;פירות|🍎|fruit;תמרים|🌴|dates`,
  'לחם ומאפים': `לחמניות|🥖|bread rolls;לחמניה|🥖|bread roll;לחם|🍞|bread;פיתות|🫓|pita bread;פיתה|🫓|pita;חלה|🍞|challah;חלות|🍞|challah;באגט|🥖|baguette;טורטיה|🫓|tortilla;לאפה|🫓|lafa bread;קרואסון|🥐|croissant;עוגה|🍰|cake;עוגיות|🍪|cookies;בורקס|🥐|bourekas;פירורי לחם|🍞|breadcrumbs`,
  'חלב וביצים': `חלב|🥛|milk carton;ביצים|🥚|eggs;ביצה|🥚|eggs;גבינה לבנה|🧀|white cheese;גבינה צהובה|🧀|yellow cheese slices;גבינת|🧀|cheese;גבינה|🧀|cheese;קוטג'|🧀|cottage cheese;קוטג|🧀|cottage cheese;יוגורט|🥛|yogurt;יוגורטים|🥛|yogurt;מעדנים|🍮|pudding cups;מעדן|🍮|pudding;שמנת|🥛|cream;חמאה|🧈|butter;לבנה|🥛|labneh;בולגרית|🧀|feta cheese;צפתית|🧀|tzfatit cheese;מוצרלה|🧀|mozzarella;פרמזן|🧀|parmesan;שוקו|🥛|chocolate milk;מילקי|🍮|chocolate pudding;דני|🍮|pudding;אשל|🥛|leben;לבן|🥛|leben;גיל|🥛|leben;חלב סויה|🥛|soy milk;חלב שקדים|🥛|almond milk;מרגרינה|🧈|margarine`,
  'בשר עוף ודגים': `חזה עוף|🍗|chicken breast;שניצל|🍗|schnitzel;עוף|🍗|chicken;כרעיים|🍗|chicken legs;שוקיים|🍗|chicken drumsticks;כנפיים|🍗|chicken wings;פרגית|🍗|chicken thighs;הודו|🦃|turkey;בשר טחון|🥩|ground beef;טחון|🥩|ground beef;בשר|🥩|beef meat;סטייק|🥩|steak;אנטריקוט|🥩|ribeye steak;צלע|🥩|beef ribs;קבב|🍖|kebab;המבורגר|🍔|burger patties;נקניקיות|🌭|hot dogs;נקניקיה|🌭|hot dog;דג|🐟|fish fillet;דגים|🐟|fish;סלמון|🐟|salmon;אמנון|🐟|tilapia;בקלה|🐟|cod;כבד|🥩|liver`,
  'מעדנייה': `פסטרמה|🥓|pastrami;נקניק|🥓|salami;סלמי|🥓|salami;חומוס|🥣|hummus;טחינה|🥣|tahini;סלטים|🥗|salads;סלט|🥗|salad;זיתים|🫒|olives;חמוצים|🥒|pickles;מלפפון חמוץ|🥒|pickles;כבד קצוץ|🥣|chopped liver;מטבוחה|🥫|matbucha`,
  'קפואים': `קפוא|🧊|frozen food;קפואים|🧊|frozen food;גלידה|🍦|ice cream;שלגון|🍦|popsicle;פיצה|🍕|pizza;בצק עלים|🥐|puff pastry;מלוואח|🫓|malawach;ג'חנון|🫓|jachnun;אפונה|🫛|peas;שעועית ירוקה|🫛|green beans;צ'יפס|🍟|french fries;קרח|🧊|ice;בורקס קפוא|🥐|frozen bourekas;ירקות קפואים|🧊|frozen vegetables`,
  'יבשים ובישול': `אורז|🍚|rice;פסטה|🍝|pasta;ספגטי|🍝|spaghetti;אטריות|🍜|noodles;פתיתים|🍝|ptitim couscous;קוסקוס|🍚|couscous;קמח|🌾|flour;סוכר|🍬|sugar;מלח|🧂|salt;פלפל שחור|🧂|black pepper;פפריקה|🌶️|paprika;כורכום|🧂|turmeric;כמון|🧂|cumin;תבלינים|🧂|spices;שמן זית|🫒|olive oil;שמן|🫒|cooking oil;חומץ|🍶|vinegar;עדשים|🫘|lentils;שעועית|🫘|beans;חומוס יבש|🫘|chickpeas;גרגירי חומוס|🫘|chickpeas;בורגול|🌾|bulgur;קינואה|🌾|quinoa;שמרים|🍞|yeast;אבקת אפייה|🧁|baking powder;סודה לשתיה|🧁|baking soda;וניל|🧁|vanilla;שוקולד מריר|🍫|dark chocolate;אגוזים|🥜|nuts;שקדים|🥜|almonds;צימוקים|🍇|raisins;אבקת מרק|🍲|soup powder;מרק|🍲|soup;פירורי|🍞|breadcrumbs;קורנפלור|🌽|cornstarch;דבש|🍯|honey;סילאן|🍯|date syrup`,
  'שימורים ורטבים': `טונה|🐟|canned tuna;תירס בקופסה|🌽|canned corn;רסק|🥫|tomato paste;רוטב עגבניות|🥫|tomato sauce;רוטב|🥫|sauce;קטשופ|🥫|ketchup;מיונז|🥫|mayonnaise;חרדל|🥫|mustard;שימורים|🥫|canned food;זיתים בקופסה|🫒|canned olives;אפונה וגזר|🥫|canned peas carrots;פטריות בקופסה|🍄|canned mushrooms;חמאת בוטנים|🥜|peanut butter;ממרח|🍯|spread;ריבה|🍓|jam;סויה|🥫|soy sauce;קונפיטורה|🍓|jam`,
  'ארוחת בוקר': `קורנפלקס|🥣|cornflakes;דגני בוקר|🥣|breakfast cereal;דגנים|🥣|cereal;גרנולה|🥣|granola;שיבולת שועל|🥣|oats;קוואקר|🥣|oatmeal;נוטלה|🍫|nutella;ממרח שוקולד|🍫|chocolate spread;קפה|☕|coffee;נס קפה|☕|instant coffee;תה|🍵|tea;קקאו|☕|cocoa`,
  'חטיפים ומתוקים': `במבה|🥜|bamba snack;ביסלי|🥨|bissli snack;חטיפים|🍿|snacks;חטיף|🍫|snack bar;שוקולד|🍫|chocolate;סוכריות|🍬|candy;מסטיק|🍬|chewing gum;צ'יפס שקית|🍟|potato chips;פופקורן|🍿|popcorn;בייגלה|🥨|pretzels;וופלים|🧇|wafers;גלי|🍮|jelly;קרקרים|🍘|crackers;פריכיות|🍘|rice cakes;גרעינים|🌻|sunflower seeds`,
  'משקאות': `מים מינרלים|💧|mineral water bottles;מים|💧|water bottles;סודה|🫧|soda water;קולה|🥤|cola;ספרייט|🥤|sprite;מיץ|🧃|juice;פטל|🧃|raspberry syrup;תרכיז|🧃|juice concentrate;בירה|🍺|beer;יין|🍷|wine;שתיה|🥤|soft drinks;שתייה|🥤|soft drinks;משקה|🥤|drink;פריגת|🧃|orange juice;ספרינג|🧃|juice;אייס קפה|☕|iced coffee`,
  'ניקיון': `אקונומיקה|🧴|bleach;נוזל כלים|🧽|dish soap;סבון כלים|🧽|dish soap;טבליות למדיח|🧽|dishwasher tablets;מדיח|🧽|dishwasher tablets;אבקת כביסה|🧺|laundry detergent;ג'ל כביסה|🧺|laundry gel;כביסה|🧺|laundry detergent;מרכך כביסה|🧺|fabric softener;מרכך|🧺|fabric softener;ספוג|🧽|sponge;ספוגים|🧽|sponges;סקוטש|🧽|scouring pad;מגבונים|🧻|wet wipes;שקיות זבל|🗑️|garbage bags;שקיות אשפה|🗑️|garbage bags;מנקה|🧴|cleaner;מטליות|🧽|cleaning cloths;סמרטוט|🧽|mop cloth;ניקוי|🧴|cleaning spray;וינדקס|🧴|glass cleaner;מסיר שומנים|🧴|degreaser`,
  'פארם והיגיינה': `נייר טואלט|🧻|toilet paper;נייר טואלט|🧻|toilet paper;מגבות נייר|🧻|paper towels;מגבת נייר|🧻|paper towels;טישו|🧻|tissues;שמפו|🧴|shampoo;מרכך שיער|🧴|conditioner;סבון|🧼|soap;ג'ל רחצה|🧴|shower gel;משחת שיניים|🪥|toothpaste;מברשת שיניים|🪥|toothbrush;דאודורנט|🧴|deodorant;סכיני גילוח|🪒|razors;קרם|🧴|cream lotion;תחבושות|🩹|pads;פלסטרים|🩹|band aids;אקמול|💊|paracetamol;תרופה|💊|medicine;ויטמינים|💊|vitamins;צמר גפן|☁️|cotton pads;מקלוני אוזניים|☁️|cotton swabs`,
  'תינוקות': `חיתולים|🍼|diapers;טיטולים|🍼|diapers;מטרנה|🍼|baby formula;תמ"ל|🍼|baby formula;מוצץ|🍼|pacifier;בקבוק תינוק|🍼|baby bottle;מגבונים לתינוק|🧻|baby wipes;דייסה|🥣|baby cereal;מחית|🥣|baby food puree`,
  'בית וחד"פ': `צלחות חד פעמיות|🍽️|disposable plates;צלחות|🍽️|disposable plates;כוסות|🥤|disposable cups;סכו"ם|🍴|plastic cutlery;מפיות|🧻|napkins;נייר אפייה|📜|baking paper;נייר כסף|📜|aluminum foil;ניילון נצמד|📜|cling wrap;שקיות|🛍️|bags;שקיות הקפאה|🛍️|freezer bags;תבניות|🍽️|aluminum pans;נרות|🕯️|candles;סוללות|🔋|batteries;נורה|💡|light bulb;גפרורים|🔥|matches;מצית|🔥|lighter;פחם|🔥|charcoal`,
};

export const DICT = [];
for (const [category, s] of Object.entries(RAW)) {
  for (const part of s.split(';')) {
    const [kw, emoji, en] = part.split('|');
    if (kw) DICT.push({ kw: kw.trim(), emoji, en, category });
  }
}
DICT.sort((a, b) => b.kw.length - a.kw.length);

function wordMatch(tokens, kw) {
  // מילים קצרות (תה, דג, מים, יין) — רק כמילה שלמה, כדי ש"שתייה" לא תיחשב "תה"
  return tokens.some((t) => t === kw || ((t[0] === 'ו' || t[0] === 'ה') && t.slice(1) === kw));
}

export function classify(name) {
  const n = name.replace(/[״"]/g, '"').trim();
  const tokens = n.split(/[\s,.\-–]+/).filter(Boolean);
  for (const d of DICT) {
    const short = d.kw.length <= 3 && !d.kw.includes(' ');
    if (short ? wordMatch(tokens, d.kw) : n.includes(d.kw)) return d;
  }
  return null;
}
