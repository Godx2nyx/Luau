const express = require("express");
const path = require("path");

const app = express();

const PORT =
  process.env.PORT || 3000;

app.use(
  express.json({
    limit: "2mb"
  })
);

/*
 * Serve frontend
 */
app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/*
 * Health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Luau Obfuscator",
    status: "ready"
  });
});

/*
 * Obfuscation API
 */
app.post(
  "/api/obfuscate",
  (req, res) => {
    try {
      const {
        source,
        options
      } = req.body || {};

      if (
        typeof source !== "string"
      ) {
        return res.status(400).json({
          error:
            "source must be a string"
        });
      }

      if (
        source.length > 2 * 1024 * 1024
      ) {
        return res.status(413).json({
          error:
            "Source is too large"
        });
      }

      const {
        obfuscate
      } = require(
        "./src/obfuscator"
      );

      const safeOptions =
        options &&
        typeof options === "object"
          ? {
              solveMath:
                options.solveMath !== false,

              hideConstants:
                options.hideConstants !== false,

              vm:
                options.vm === true
            }
          : {
              solveMath: true,
              hideConstants: true,
              vm: false
            };

      const result =
        obfuscate(
          source,
          safeOptions
        );

      res.json({
        output: result.code,

        stats: result.stats,

        vm: result.vm || null
      });
    } catch (err) {
      console.error(
        "Obfuscation error:",
        err
      );

      res.status(500).json({
        error:
          err &&
          err.message
            ? err.message
            : "Obfuscation failed"
      });
    }
  }
);

/*
 * Frontend fallback
 */
app.get(
  "*",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/*
 * Start server
 */
app.listen(
  PORT,
  () => {
    console.log("");
    console.log(
      "================================="
    );
    console.log(
      "       Luau Obfuscator Server"
    );
    console.log(
      "================================="
    );
    console.log(
      `Local: http://localhost:${PORT}`
    );
    console.log(
      "API: /api/obfuscate"
    );
    console.log(
      "VM: Available"
    );
    console.log(
      "Status: Ready"
    );
    console.log(
      "================================="
    );
    console.log("");
  }
);
