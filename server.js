const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt is required."
      });
    }

    const apiKey = process.env.POLLINATIONS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Pollinations API key is not configured on the server."
      });
    }

    const imageUrl =
      "https://gen.pollinations.ai/image/" +
      encodeURIComponent(prompt) +
      "?model=flux";

    const response = await fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: "Image generation failed: " + errorText
      });
    }

    const contentType =
      response.headers.get("content-type") || "image/jpeg";

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    const image =
      `data:${contentType};base64,${buffer.toString("base64")}`;

    res.json({ image });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Server error while generating image."
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `AI Photo Studio running on port ${PORT}`
  );
});
