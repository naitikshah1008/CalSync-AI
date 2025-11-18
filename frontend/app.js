document.getElementById("submitBtn").addEventListener("click", async () => {
  const clientId = document.getElementById("clientId").value.trim();
  const clientSecret = document.getElementById("clientSecret").value.trim();
  const redirectUri = document.getElementById("redirectUri").value.trim();

  const statusEl = document.getElementById("status");

  if (!clientId || !clientSecret || !redirectUri) {
    statusEl.textContent = "All fields are required.";
    return;
  }

  const payload = {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: [redirectUri]
  };

  try {
    const res = await fetch("http://localhost:8000/api/v1/calendar/google-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      statusEl.textContent = "Credentials saved successfully!";
    } else {
      const err = await res.text();
      statusEl.textContent = "Error: " + err;
    }

  } catch (err) {
    console.error(err);
    statusEl.textContent = "Network or server error.";
  }
});
