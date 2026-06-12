export const compressImageToWebp = async (file, maxMegabytes = 1) => {
  return new Promise((resolve, reject) => {
    // Check if the file is already under the limit
    if (file.size / (1024 * 1024) <= maxMegabytes && file.type === "image/webp") {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        // Calculate new dimensions (if excessively large, resize it to max 1920x1080 bounds)
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP
        const compress = (quality) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error("Canvas to Blob conversion failed"));
              }
              
              // If still too large and we can compress more, try again
              if (blob.size / (1024 * 1024) > maxMegabytes && quality > 0.3) {
                compress(quality - 0.2);
              } else {
                // Convert blob to File object
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), {
                  type: "image/webp",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              }
            },
            "image/webp",
            quality
          );
        };

        // Start compression with 0.9 quality
        compress(0.9);
      };

      img.onerror = (error) => reject(error);
    };

    reader.onerror = (error) => reject(error);
  });
};
