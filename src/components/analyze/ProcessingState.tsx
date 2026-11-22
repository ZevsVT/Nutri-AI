export function ProcessingState({ previewImage }: { previewImage: string | null }) {
  return (
    <div className="scanner-container-card" aria-busy="true" role="status">
      {previewImage && (
        <div className="scanner-image-view" style={{ backgroundImage: `url(${previewImage})` }} />
      )}
      <div className="scanner-content-pane">
        <h3>Identifying foods in your photo</h3>
        <p>Suggestions will appear here when analysis is ready.</p>
      </div>
    </div>
  );
}
