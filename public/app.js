const $ = id => document.getElementById(id);

const input = $("input");
const output = $("output");
const obfuscateBtn = $("obfuscateBtn");
const copyBtn = $("copyBtn");
const downloadBtn = $("downloadBtn");
const clearBtn = $("clearBtn");
const hideConstants = $("hideConstants");
const solveMath = $("solveMath");
const message = $("message");

/*
 * Update status text.
 */
function setMessage(text) {
  if (message) {
    message.textContent = text;
  }
}

/*
 * Obfuscate source.
 */
obfuscateBtn.addEventListener("click", async () => {
  const source = input.value;

  if (!source.trim()) {
    setMessage("Input is empty.");
    return;
  }

  obfuscateBtn.disabled = true;
  setMessage("Processing...");

  try {
    const response = await fetch(
      "/api/obfuscate",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          source,

          options: {
            hideConstants:
              hideConstants.checked,

            solveMath:
              solveMath.checked
          }
        })
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Server returned invalid JSON."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Obfuscation failed."
      );
    }

    /*
     * Supports the object returned by
     * the current obfuscator.
     */
    if (
      data.output &&
      typeof data.output === "string"
    ) {
      output.value = data.output;
    } else if (
      data.output &&
      typeof data.output.code === "string"
    ) {
      output.value = data.output.code;
    } else {
      throw new Error(
        "Server returned no output."
      );
    }

    setMessage("Obfuscation complete.");
  } catch (error) {
    console.error(error);

    setMessage(
      error.message ||
      "Something went wrong."
    );
  } finally {
    obfuscateBtn.disabled = false;
  }
});

/*
 * Copy output.
 */
copyBtn.addEventListener("click", async () => {
  const text = output.value;

  if (!text) {
    setMessage("Nothing to copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);

    setMessage(
      "Output copied to clipboard."
    );
  } catch {
    /*
     * Fallback for browsers where
     * navigator.clipboard is unavailable.
     */
    output.focus();
    output.select();

    document.execCommand("copy");

    setMessage(
      "Output copied to clipboard."
    );
  }
});

/*
 * Download .luau file.
 */
downloadBtn.addEventListener(
  "click",
  () => {
    const text = output.value;

    if (!text) {
      setMessage("Nothing to download.");
      return;
    }

    const blob = new Blob(
      [text],
      {
        type:
          "text/plain;charset=utf-8"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      "obfuscated.luau";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    setMessage(
      "Downloaded obfuscated.luau."
    );
  }
);

/*
 * Clear input and output.
 */
clearBtn.addEventListener(
  "click",
  () => {
    input.value = "";
    output.value = "";

    setMessage("Cleared.");
  }
);

/*
 * Ctrl + Enter / Cmd + Enter
 * runs the obfuscator.
 */
input.addEventListener(
  "keydown",
  event => {
    if (
      (event.ctrlKey ||
        event.metaKey) &&
      event.key === "Enter"
    ) {
      event.preventDefault();

      obfuscateBtn.click();
    }
  }
);
