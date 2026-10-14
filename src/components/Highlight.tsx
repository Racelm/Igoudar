// ts_headline markiert Treffer mit <mark>. Alles andere wird als Text ausgegeben,
// damit Inhalte aus PDFs oder Webseiten nie als HTML im Browser landen.
export function Highlight({ text }: { text: string }) {
  const parts = text.split(/(<mark>|<\/mark>)/);
  let on = false;
  return (
    <>
      {parts.map((p, i) => {
        if (p === "<mark>") {
          on = true;
          return null;
        }
        if (p === "</mark>") {
          on = false;
          return null;
        }
        return on ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>;
      })}
    </>
  );
}
