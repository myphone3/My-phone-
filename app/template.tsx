// נטען מחדש בכל מעבר עמוד, וכך התוכן החדש נכנס במעבר חלק (ראו .page-enter ב-globals.css)
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
