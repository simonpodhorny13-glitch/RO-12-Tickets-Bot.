const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const fs = require("fs");
require("dotenv").config();

/* ---------------- EXPRESS ---------------- */

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("RO-12 bot is alive"));

app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`)
);

/* ---------------- DISCORD ---------------- */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

/* ---------------- DATA ---------------- */

let data = loadData();
let activeVoyage = null;
let voyageId = 1;

/* ---------------- FILES ---------------- */

function loadData() {
  try {
    if (!fs.existsSync("data.json")) {
      return { users: {}, seatMap: {}, cabinMap: {} };
    }
    return JSON.parse(fs.readFileSync("data.json", "utf8"));
  } catch {
    return { users: {}, seatMap: {}, cabinMap: {} };
  }
}

function saveData() {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

/* ---------------- USER ---------------- */

function getUser(id) {
  if (!data.users[id]) {
    data.users[id] = { balance: 250, seat: null, cabin: null };
    saveData();
  }
  return data.users[id];
}

/* ---------------- UTILS ---------------- */

function isValidSeat(seat) {
  return /^([1-9]|1[0-9]|20)[A-F]$/.test(seat);
}

function getRouteData(code) {
  if (code === "1") return { name: "Short", multiplier: 1 };
  if (code === "2") return { name: "Medium", multiplier: 1.5 };
  if (code === "3") return { name: "Long", multiplier: 2 };
  return { name: "Unknown", multiplier: 1 };
}

function getBasePrice() {
  return 50 * (activeVoyage?.multiplier || 1);
}

/* ---------------- EMBED ---------------- */

function sendVoyageEmbed(client) {
  if (!activeVoyage || activeVoyage.salesOpen) return;

  activeVoyage.salesOpen = true;

  const ch = client.channels.cache.find(c => c.name === "voyages");
  if (!ch) return;

  ch.send({
    embeds: [{
      color: 0x0099ff,
      title: "🚢 NEW VOYAGE SALES OPEN",
      fields: [
        { name: "From", value: activeVoyage.from, inline: true },
        { name: "To", value: activeVoyage.to, inline: true },
        { name: "Ship", value: activeVoyage.ship, inline: true },

        { name: "Captain", value: activeVoyage.captain ? `<@${activeVoyage.captain}>` : "TBA", inline: true },
        { name: "F/O", value: activeVoyage.fo ? `<@${activeVoyage.fo}>` : "TBA", inline: true },
        { name: "GC", value: activeVoyage.gc ? `<@${activeVoyage.gc}>` : "None", inline: true },

        { name: "Departure", value: activeVoyage.departure, inline: false },
        { name: "Route", value: activeVoyage.length, inline: true },
        { name: "Price", value: `$${getBasePrice()}`, inline: true },
      ]
    }]
  });
}

/* ---------------- EVENTS ---------------- */

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* ---------------- MESSAGE LOGIC ---------------- */

require("./events/messageCreate")(client, {
  data,
  activeVoyage,
  voyageId,
  saveData,
  getUser,
  isValidSeat,
  getRouteData,
  getBasePrice,
  sendVoyageEmbed
});

/* ---------------- LOGIN ---------------- */

client.login(process.env.TOKEN);
