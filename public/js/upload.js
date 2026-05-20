import { createPlanet } from "./api.js";

export function initUploadDialog({ onUploaded }) {
  const uploadDialog = document.getElementById("upload-dialog");
  const uploadForm = document.getElementById("upload-form");
  const uploadStatus = document.getElementById("upload-status");
  const cancelUpload = document.getElementById("cancel-upload");
  const createBtn = document.getElementById("create-planet-btn");
  let currentStarId = null;

  function setStatus(msg, isError = false) {
    uploadStatus.textContent = msg;
    uploadStatus.style.color = isError ? "#ff799a" : "#9aa8d4";
  }

  createBtn.addEventListener("click", () => {
    if (!currentStarId) return;
    setStatus("");
    uploadDialog.showModal();
  });

  cancelUpload.addEventListener("click", () => uploadDialog.close());

  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentStarId) return;
    const formData = new FormData(uploadForm);
    const video = formData.get("video");
    if (!video || !video.size) {
      setStatus("Seleziona un file video", true);
      return;
    }
    if (video.size > 100 * 1024 * 1024) {
      setStatus("File troppo grande. Massimo 100MB.", true);
      return;
    }
    formData.append("star_id", currentStarId);
    setStatus("Upload in corso...");
    try {
      await createPlanet(formData);
      setStatus("Pianeta creato con successo");
      uploadForm.reset();
      uploadDialog.close();
      await onUploaded?.();
    } catch (err) {
      setStatus(err.message, true);
    }
  });

  return {
    setStar(starId) {
      currentStarId = starId;
    },
    showButton(show) {
      createBtn.classList.toggle("hidden", !show);
    },
  };
}
