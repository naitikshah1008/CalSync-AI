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
    const res = await fetch("http://localhost:8080/api/v1/calendar/google-calendar", {
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

document.getElementById("oauthBtn").addEventListener("click", async (event) => {
  event.preventDefault();
  console.log("OAuth button clicked");

  const res = await fetch("http://localhost:8080/api/v1/calendar/auth-url");

  const text = await res.text();
  console.log("RAW RESPONSE:", text);

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    return;
  }

  console.log("Parsed data:", data);

  if (!data.auth_url) {
    console.error("auth_url missing");
    return;
  }

  window.location.href = data.auth_url;
});
