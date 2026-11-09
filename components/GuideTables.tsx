'use client';

import { DEVICE_TYPES } from '@/lib/versionGuide';
import { AllVersionsTable, VersionTable } from './VersionGuide';

// הטבלאות שבתוך המדריכים
export default function GuideTable({ which }: { which: 'versions' | 'types' }) {
  return (
    <div className="bg-white border-2 border-orange-100 rounded-2xl p-3 sm:p-4 not-prose leading-normal">
      {which === 'types' ? (
        <>
          <VersionTable versions={DEVICE_TYPES} />
          <p className="text-[11px] text-gray-500 mt-2">בתומך כשר בוחרים גרסה, ו&quot;יש&quot; אומר שאפשר לקבל את זה באחת הגרסאות. וואטסאפ וניווט: רק בגרסת כשר פליי.</p>
        </>
      ) : (
        <AllVersionsTable />
      )}
    </div>
  );
}
