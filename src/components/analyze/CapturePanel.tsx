import { useRef } from "react";
import { Icon } from "../../icons";
import { Button } from "../common/Button";

export function CapturePanel({
  onPhoto,
  onOpenManual,
}: {
  onPhoto: (file: File) => void;
  onOpenManual: () => void;
}) {
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const accept = "image/jpeg,image/png,image/webp";

  function choosePhoto(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (file) onPhoto(file);
  }

  return (
    <section className="upload-dropzone-panel">
      <div className="dropzone-inner">
        <div className="dropzone-icon-circle"><Icon name="camera" size={28} /></div>
        <h3>Upload or take a photo</h3>
        <p>JPEG, PNG, or WebP. We send your photo to the configured AI provider to identify foods.</p>
        <div className="dropzone-actions">
          <Button icon="upload" onClick={() => upload.current?.click()}>Select image</Button>
          <Button icon="camera" onClick={() => camera.current?.click()}>Take photo</Button>
          <Button onClick={onOpenManual}>Enter food manually</Button>
        </div>
        <input ref={upload} type="file" accept={accept} hidden onChange={(e) => choosePhoto(e.currentTarget)} />
        <input ref={camera} type="file" accept={accept} capture="environment" hidden onChange={(e) => choosePhoto(e.currentTarget)} />
      </div>
    </section>
  );
}
