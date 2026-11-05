import LegalPage, { Section } from '@/components/LegalPage';
import Fill from '@/components/Fill';
import { BUSINESS as B } from '@/lib/business';

export const metadata = { title: 'הצהרת נגישות | NEW PHONE' };

export default function AccessibilityPage() {
  return (
    <LegalPage title="הצהרת נגישות">
      <p>
        אנחנו ב-NEW PHONE רואים חשיבות רבה במתן שירות שוויוני לכל הלקוחות, ופועלים להנגשת האתר לאנשים עם מוגבלות, בהתאם לחוק
        שוויון זכויות לאנשים עם מוגבלות ולתקנות הנגישות לשירות.
      </p>

      <Section title="רמת הנגישות באתר">
        <p>
          אנו פועלים להתאמת האתר לדרישות התקן הישראלי ת&quot;י 5568, המבוסס על הנחיות WCAG 2.0 ברמה AA. האתר נמצא בתהליך
          הנגשה מתמשך.
        </p>
      </Section>

      <Section title="מה כבר נעשה באתר">
        <ul className="list-disc pr-5 space-y-1">
          <li>האתר מוגדר בשפה העברית ובכיוון מימין לשמאל, כך שקוראי מסך מקריאים אותו כראוי.</li>
          <li>האתר מותאם לצפייה בטלפון, בטאבלט ובמחשב.</li>
          <li>ניתן להגדיל את התצוגה באמצעות הדפדפן (Ctrl ו-+) בלי לפגוע בתוכן.</li>
          <li>מבנה העמודים כולל כותרות ברורות וניווט עקבי.</li>
        </ul>
      </Section>

      <Section title="חלקים שעדיין אינם נגישים במלואם">
        <p>
          ייתכן שחלק מהתמונות עדיין חסרות תיאור טקסטואלי, ושחלק מהרכיבים אינם נגישים במלואם לניווט במקלדת בלבד. אנו פועלים
          לתקן זאת. אם נתקלתם בקושי, נשמח לעזור לכם להשלים את ההזמנה בטלפון.
        </p>
      </Section>

      <Section title="רכז/ת נגישות ופניות">
        <p>נתקלתם בבעיית נגישות? נשמח לשמוע ולתקן. פרטי הקשר:</p>
        <ul className="list-disc pr-5 space-y-1">
          {B.accessibility.name && <li>שם: {B.accessibility.name}</li>}
          <li>
            טלפון: <Fill value={B.accessibility.phone || B.phone} label="טלפון" />
          </li>
          <li>
            מייל: <Fill value={B.accessibility.email || B.email} label="מייל" />
          </li>
        </ul>
        <p>נשתדל לחזור לכל פנייה בהקדם.</p>
      </Section>
    </LegalPage>
  );
}
