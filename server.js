const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Obfuscation API
app.post("/api/obfuscate", (req, res) => {
  try {
    const { source, options } = req.body || {};

    if (typeof source !== "string") {
      return res.status(400).json({
        error: "source must be a string"
      });
    }

    const { obfuscate } = require("./src/obfuscator");

    const output = obfuscate(source, options || {});

    res.json({
      output
    });
  } catch (err) {
    console.error("Obfuscation error:", err);

    res.status(500).json({
      error: err.message || "Obfuscation failed"
    });
  }
});

// Frontend fallback
app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// Start server
app.listen(PORT, () => {
  console.log("");
  console.log("=================================");
  console.log("      Luau Obfuscator Server");
  console.log("=================================");
  console.log(`Local: http://localhost:${PORT}`);
  console.log("Status: Ready");
  console.log("=================================");
  console.log("");
});
