const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const express = require("express");

// ---------------- WEB SERVER (RENDER FIX) ----------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("RO-12 bot is alive");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on port ${PORT}`);
});

// ---------------- BOT SETUP ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;

// ---------------- DATA ----------------
function loadData() {
  try {
    return JSON.parse(fs.readFileSync("data.json", "utf8"));
  } catch {
    return {
      users: {},
      seatMap: {},
      cabinMap: {}
    };
  }
}

function saveData() {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

let data = loadData();

// ---------------- VOYAGE STATE ----------------
let activeVoyage = null;
let voyageId = 1;

const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

// ---------------- CABINS ----------------
const CABINS = {
  economy: ["1A", "1B", "2A", "2B"],
  first: ["1C", "1D", "2C", "2D"],
  double: ["3A", "3B", "3C", "3D"]
};

// ---------------- HELPERS ----------------
function getUser(id) {
  if (!data.users[id]) {
    data.users[id] = {
      balance: 250,
      seat: null,
      cabin: null,
      lastClaim: Date.now()
    };
    saveData();
  }
  return data.users[id];
}

function isValidSeat(seat) {
  return /^([1-9]|1[0-9]|20)([A-F])$/.test(seat);
}

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ---------------- COMMANDS ----------------
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const channel = message.channel.name;
  const content = message.content;
  const user = getUser(message.author.id);

  const allowed = ["bots", "tickets", "staff", "voyages"];
  if (!allowed.includes(channel)) return;

  // ---------------- BALANCE ----------------
  if (content === "!balance") {
    return message.reply(`💵 Balance: $${user.balance}`);
  }

  // ---------------- SEAT ----------------
  if (content.startsWith("!seat")) {
    const seat = content.split(" ")[1];
    if (!isValidSeat(seat)) return message.reply("❌ Invalid seat (1A–20F)");
    if (data.seatMap[seat]) return message.reply("❌ Seat already taken.");
    data.seatMap[seat] = message.author.id;
    user.seat = seat;
    saveData();
    return message.reply(`💺 Seat booked: ${seat}`);
  }

  // ---------------- CABIN ----------------
  if (content.startsWith("!cabin")) {
    const cabin = content.split(" ")[1];
    const type = content.split(" ")[2];
    if (!CABINS[type]?.includes(cabin)) return message.reply("❌ Invalid cabin.");
    if (data.cabinMap[cabin]) return message.reply("❌ Cabin already taken.");
    data.cabinMap[cabin] = message.author.id;
    user.cabin = cabin;
    saveData();
    return message.reply(`🛏️ Cabin booked: ${cabin}`);
  }

  // ---------------- MAP SEATS ----------------
  if (content === "!map seats") {
    let out = "🛳️ RO-12 SEAT MAP\n\n";
    for (let r = 1; r <= 20; r++) {
      let row = `${String(r).padStart(2, "0")} `;
      for (const l of ["A", "B", "C", "D", "E", "F"]) {
        const seat = `${r}${l}`;
        row += data.seatMap[seat] ? "[X]" : "[ ]";
      }
      out += row + "\n";
    }
    return message.reply(out);
  }

  // ---------------- MAP CABINS ----------------
  if (content.startsWith("!map cabins")) {
    let out = "🛏️ CABINS\n\n";
    for (const type in CABINS) {
      out += `\n${type.toUpperCase()}\n`;
      for (const cabin of CABINS[type]) {
        out += `${cabin} ${data.cabinMap[cabin] ? "[X]" : "[ ]"}\n`;
      }
    }
    return message.reply(out);
  }

  // ---------------- SET VOYAGE ----------------
  if (content.startsWith("!setvoyage")) {
    if (channel !== "staff") return;
    const [, from, to, length] = content.split(" ");
    activeVoyage = {
      id: voyageId++,
      from,
      to,
      length,
      captain: null,
      fo: null,
      gc: null,
      gcDeadline: Date.now() + ONE_DAY,
      departure: Date.now() + FIVE_DAYS,
      salesOpen: false
    };
    return message.channel.send(`🚢 VOYAGE CREATED\n\n${from} → ${to}\nLength: ${length}\n\nCrew: Captain + First Officer (+ optional GC)`);
  }

  // ---------------- CLAIMS ----------------
  if (!activeVoyage) return;
  if (content === "!claim captain") {
    if (activeVoyage.captain) return message.reply("Taken");
    activeVoyage.captain = message.author.username;
    return message.reply("Captain claimed");
  }
  if (content === "!claim fo") {
    if (activeVoyage.fo) return message.reply("Taken");
    activeVoyage.fo = message.author.username;
    return message.reply("First Officer claimed");
  }
  if (content === "!claim gc") {
    if (activeVoyage.gc) return message.reply("Taken");
    activeVoyage.gc = message.author.username;
    return message.reply("Ground Crew claimed");
  }
});

// ---------------- VOYAGE CHECKER ----------------
setInterval(() => {
  if (!activeVoyage) return;
  const now = Date.now();
  if (!activeVoyage.gc && now > activeVoyage.gcDeadline) activeVoyage.gc = "Unassigned";
  if (activeVoyage.captain && activeVoyage.fo && !activeVoyage.salesOpen) {
    activeVoyage.salesOpen = true;
    const channel = client.channels.cache.find(c => c.name === "voyages");
    if (channel) {
      channel.send(`🚢 VOYAGE CONFIRMED\n\nRoute: ${activeVoyage.from} → ${activeVoyage.to}\nCaptain: ${activeVoyage.captain}\nFirst Officer: ${activeVoyage.fo}\nGround Crew: ${activeVoyage.gc || "None"}`);
    }
  }
}, 60000);

// ---------------- LOGIN ----------------
client.login(TOKEN);
