export function Home() {
  return (
    <>
      <hgroup>
        <h1>Excel Tools</h1>
        <p>Free Excel tools that run right in your browser.</p>
      </hgroup>
      <div class="tools">
        <article>
          <h3>Merge</h3>
          <p>Combine several Excel files into one: every sheet is copied into a new workbook.</p>
          <a href="#/merge" role="button">Open Merge</a>
        </article>
        <article>
          <h3>Split</h3>
          <p>Split an Excel file into separate files, one per sheet.</p>
          <a href="#/split" role="button">Open Split</a>
        </article>
      </div>
    </>
  );
}
