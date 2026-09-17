const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// Multer - memory मध्ये files ठेवतो
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 2,
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG and WEBP images are allowed."));
    }
  }
});

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// ==========================================
// AI PHOTO EDIT / GENERATE
// ==========================================

app.post(
  "/api/generate",
  upload.array("images", 2),
  async (req, res) => {
    try {
      const userPrompt = req.body.prompt;

const prompt = `${userPrompt}

Use the uploaded photo(s) as strict identity references.
Keep each person's identity and facial features as close to the reference photo(s) as possible.
Preserve facial proportions, eyes, nose, lips, jawline, skin tone, age and natural appearance.
Do not redesign, beautify, or replace the faces.
Only make the changes specifically requested by the user.
Keep both people clearly recognizable as the same people from their reference photos.`;
      const files = req.files || [];

      if (!prompt) {
        return res.status(400).json({
          error: "Prompt is required."
        });
      }

      if (files.length === 0) {
        return res.status(400).json({
          error: "At least one image is required."
        });
      }

      if (files.length > 2) {
        return res.status(400).json({
          error: "Maximum 2 images are allowed."
        });
      }

      const apiKey = process.env.POLLINATIONS_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          error:
            "Pollinations API key is not configured on the server."
        });
      }

      const pollinationsUrl =
        "https://gen.pollinations.ai/v1/images/edits";

      const form = new FormData();

      // Prompt
      form.append("prompt", prompt);

      // Image 1 + Image 2
      for (const file of files) {
        const blob = new Blob(
          [file.buffer],
          { type: file.mimetype }
        );

        form.append(
          "image",
          blob,
          file.originalname
        );
      }

      // Image-edit model that supports reference images
form.append(
  "model",
  "black-forest-labs/flux.2-klein-4b"
);

form.append("size", "1024x1024");
form.append("n", "1");
      form.append("response_format", "b64_json");

      const response = await fetch(
        pollinationsUrl,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          body: form
        }
      );

      const responseText = await response.text();

      if (!response.ok) {
        console.error(
          "Pollinations error:",
          response.status,
          responseText
        );

        return res.status(response.status).json({
          error:
            "Pollinations image editing failed: " +
            responseText
        });
      }

      let data;

      try {
        data = JSON.parse(responseText);
      } catch (error) {
        return res.status(500).json({
          error:
            "Invalid response received from Pollinations."
        });
      }

      // Pollinations OpenAI-compatible response
      const imageData =
        data?.data?.[0]?.b64_json;

      if (!imageData) {
        console.error(
          "Unexpected Pollinations response:",
          data
        );

        return res.status(500).json({
          error:
            "No generated image was returned by Pollinations."
        });
      }

      const generatedImage =
        imageData.startsWith("data:")
          ? imageData
          : `data:image/png;base64,${imageData}`;

      return res.json({
        image: generatedImage
      });

    } catch (error) {
      console.error("Generate error:", error);

      return res.status(500).json({
        error:
          error.message ||
          "Server error while generating image."
      });
    }
  }
);


// ==========================================
// OLD EDIT ENDPOINT
// ==========================================

app.post("/api/edit", async (req, res) => {
  try {
    const { prompt, image } = req.body;

    if (!prompt || !image) {
      return res.status(400).json({
        error: "Prompt and image are required."
      });
    }

    const apiKey = process.env.POLLINATIONS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "Pollinations API key is not configured on the server."
      });
    }

    const editPrompt =
      `${prompt}. Edit the provided photo while keeping the person's identity, face, and natural appearance unchanged.`;

    const imageUrl =
      "https://gen.pollinations.ai/image/" +
      encodeURIComponent(editPrompt) +
      "?model=flux";

    const response = await fetch(
      imageUrl,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${apiKey}`
        }
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      return res.status(response.status).json({
        error:
          "Image editing failed: " +
          errorText
      });
    }

    const contentType =
      response.headers.get("content-type") ||
      "image/jpeg";

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    const editedImage =
      `data:${contentType};base64,${buffer.toString("base64")}`;

    res.json({
      image: editedImage
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        "Server error while editing image."
    });
  }
});


app.listen(PORT, () => {
  console.log(
    `AI Photo Studio running on port ${PORT}`
  );
});
