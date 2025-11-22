document.getElementById("connectGoogleBtn").addEventListener("click", async () => {
  const clientId = document.getElementById("clientId").value.trim();
  const clientSecret = document.getElementById("clientSecret").value.trim();
  const redirectUri = document.getElementById("redirectUri").value.trim();
  const statusEl = document.getElementById("status");

  // Basic validation
  if (!clientId || !clientSecret || !redirectUri) {
    statusEl.textContent = "All fields are required.";
    return;
  }

  const payload = {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: [redirectUri],
  };

  try {
    statusEl.textContent = "Saving credentials...";
    // 1) Save credentials
    const saveRes = await fetch("http://localhost:8080/api/v1/calendar/google-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!saveRes.ok) {
      const errText = await saveRes.text();
      statusEl.textContent = "Error saving credentials: " + errText;
      return;
    }
    statusEl.textContent = "Credentials saved. Getting Google OAuth URL...";
    // 2) Get auth URL
    const authRes = await fetch("http://localhost:8080/api/v1/calendar/auth-url");
    const authText = await authRes.text();
    console.log("RAW auth-url RESPONSE:", authText);
    let data;
    try {
      data = JSON.parse(authText);
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      statusEl.textContent = "Failed to parse auth-url response.";
      return;
    }
    if (!data.auth_url) {
      console.error("auth_url missing");
      statusEl.textContent = "auth_url missing from server response.";
      return;
    }
    statusEl.textContent = "Redirecting to Google OAuth...";
    // 3) Redirect to Google OAuth
    window.location.href = data.auth_url;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Network or server error.";
  }
});
