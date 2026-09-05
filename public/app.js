const input =
  document.getElementById("input");

const output =
  document.getElementById("output");

const obfuscateBtn =
  document.getElementById(
    "obfuscateBtn"
  );

const clearBtn =
  document.getElementById(
    "clearBtn"
  );

const copyBtn =
  document.getElementById(
    "copyBtn"
  );

const downloadBtn =
  document.getElementById(
    "downloadBtn"
  );

const hideConstants =
  document.getElementById(
    "hideConstants"
  );

const solveMath =
  document.getElementById(
    "solveMath"
  );

const enableVM =
  document.getElementById(
    "enableVM"
  );

const message =
  document.getElementById(
    "message"
  );

const stats =
  document.getElementById(
    "stats"
  );

function setMessage(text) {
  message.textContent = text;
}

function updateStats(data) {
  if (!data) {
    stats.hidden = true;
    return;
  }

  stats.hidden = false;

  document.getElementById(
    "statStrings"
  ).textContent =
    data.strings || 0;

  document.getElementById(
    "statNumbers"
  ).textContent =
    data.numbers || 0;

  document.getElementById(
    "statBooleans"
  ).textContent =
    data.booleans || 0;

  document.getElementById(
    "statInstructions"
  ).textContent =
    data.instructions || 0;

  document.getElementById(
    "statVMConstants"
  ).textContent =
    data.constants || 0;
}

obfuscateBtn.addEventListener(
  "click",
  async () => {
    const source =
      input.value;

    if (!source.trim()) {
      setMessage(
        "Input is empty."
      );

      output.value = "";

      return;
    }

    obfuscateBtn.disabled = true;

    obfuscateBtn.textContent =
      "Processing...";

    setMessage(
      "Obfuscating..."
    );

    try {
      const response =
        await fetch(
          "/api/obfuscate",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              source,

              options: {
                hideConstants:
                  hideConstants.checked,

                solveMath:
                  solveMath.checked,

                vm:
                  enableVM.checked
              }
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Obfuscation failed"
        );
      }

      output.value =
        data.output || "";

      updateStats(
        data.stats
      );

      if (data.stats?.vm) {
        setMessage(
          `Done • VM generated ${data.stats.instructions} instructions`
        );
      } else {
        setMessage(
          "Obfuscation complete."
        );
      }

    } catch (error) {
      output.value = "";

      updateStats(null);

      setMessage(
        error.message ||
        "Request failed."
      );
    } finally {
      obfuscateBtn.disabled =
        false;

      obfuscateBtn.innerHTML =
        "Obfuscate <b>→</b>";
    }
  }
);

clearBtn.addEventListener(
  "click",
  () => {
    input.value = "";
    output.value = "";

    updateStats(null);

    setMessage(
      "Cleared."
    );
  }
);

copyBtn.addEventListener(
  "click",
  async () => {
    if (!output.value) {
      setMessage(
        "Nothing to copy."
      );

      return;
    }

    try {
      await navigator.clipboard.writeText(
        output.value
      );

      setMessage(
        "Output copied."
      );
    } catch {
      setMessage(
        "Copy failed."
      );
    }
  }
);

downloadBtn.addEventListener(
  "click",
  () => {
    if (!output.value) {
      setMessage(
        "Nothing to download."
      );

      return;
    }

    const blob =
      new Blob(
        [output.value],
        {
          type:
            "text/plain;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const a =
      document.createElement(
        "a"
      );

    a.href = url;
    a.download =
      "obfuscated.luau";

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(
      url
    );

    setMessage(
      "Download started."
    );
  }
);
