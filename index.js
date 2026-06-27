const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const express = require("express");

// ---------------- WEB SERVER (RENDER FIX) ----------------
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("RO-12 bot is alive"));
app.listen(PORT, "0.0.0.0", () => console.log(`Web server running on port ${PORT}`));

// ---------------- BOT SETUP ----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.TOKEN;
let data = loadData();

function loadData() {
  try {
    if (!fs.existsSync("data.json")) return { users: {}, seatMap: {}, cabinMap: {} };
    const raw = fs.readFileSync("data.json", "utf8");
    const parsed = JSON.parse(raw);
    return { users: parsed.users || {}, seatMap: parsed.seatMap || {}, cabinMap: parsed.cabinMap || {} };
  } catch (e) { return { users: {}, seatMap: {}, cabinMap: {} }; }
}

function saveData() {
  try { fs.writeFileSync("data.json", JSON.stringify(data, null, 2)); } catch (e) { console.error("Save error:", e); }
}

// ---------------- VOYAGE STATE ----------------
let activeVoyage = null;
let voyageId = 1;
const ONE_DAY = 24 * 60 * 60 * 1000;
const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
const CABINS = { economy: ["1A", "1B", "2A", "2B"], first: ["1C", "1D", "2C", "2D"], double: ["3A", "3B", "3C", "3D"] };

function getUser(id) {
  if (!data.users[id]) {
    data.users[id] = { balance: 250, seat: null, cabin: null };
    saveData();
  }
  return data.users[id];
}

function isValidSeat(seat) { return /^([1-9]|1[0-9]|20)([A-F])$/.test(seat); }

client.once("ready", () => console.log(`Logged in as ${client.user.tag}`));

// ---------------- COMMANDS ----------------
// !checkvoyage (Debug command)
  if (content === "!checkvoyage") {
    if (!activeVoyage) return message.reply("No voyage active.");
    return message.reply(`Voyage Status: Captain=${activeVoyage.captain}, FO=${activeVoyage.fo}, GC=${activeVoyage.gc}, SalesOpen=${activeVoyage.salesOpen}`);
  }
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const channel = message.channel.name;
  const content = message.content;
  const user = getUser(message.author.id);
  const allowed = ["bots", "tickets", "staff", "voyages"];
  
  if (!allowed.includes(channel)) return;
  if (content.startsWith("!ticket") && channel !== "tickets") return message.reply("❌ Use #tickets channel.");

  // !balance
  if (content === "!balance") return message.reply(`💵 Balance: $${user.balance}`);

  // !seat (with booking logic)
  if (content.startsWith("!seat")) {
    if (!activeVoyage || !activeVoyage.salesOpen) return message.reply("❌ Sales not open yet.");
    if (user.seat) return message.reply(`❌ You already have a seat: ${user.seat}`);
    
    const seat = content.split(" ")[1];
    const price = 50;
    if (!isValidSeat(seat)) return message.reply("❌ Invalid seat (1A–20F)");
    if (data.seatMap[seat]) return message.reply("❌ Seat already taken.");
    if (user.balance < price) return message.reply("❌ Not enough money!");
    
    user.balance -= price;
    data.seatMap[seat] = message.author.id;
    user.seat = seat;
    saveData();
    return message.reply(`💺 Seat booked: ${seat}.`);
  }

  // !cabin (with booking logic)
  if (content.startsWith("!cabin")) {
    if (!activeVoyage || !activeVoyage.salesOpen) return message.reply("❌ Sales not open yet.");
    if (user.cabin) return message.reply(`❌ You already have a cabin: ${user.cabin}`);
    
    const [_, cabin, type] = content.split(" ");
    if (!CABINS[type]?.includes(cabin)) return message.reply("❌ Invalid cabin.");
    if (data.cabinMap[cabin]) return message.reply("❌ Cabin already taken.");
    
    data.cabinMap[cabin] = message.author.id;
    user.cabin = cabin;
    saveData();
    return message.reply(`🛏️ Cabin booked: ${cabin}`);
  }

  // !cancel
  if (content === "!cancel") {
    if (!user.seat && !user.cabin) return message.reply("❌ Nothing to cancel.");
    if (user.seat) { delete data.seatMap[user.seat]; user.seat = null; user.balance += 40; } // Refund 80%
    if (user.cabin) { delete data.cabinMap[user.cabin]; user.cabin = null; }
    saveData();
    return message.reply("✅ Booking cancelled. (Seats partially refunded)");
  }

  // !map
  if (content === "!map seats") {
    let out = "🛳️ SEAT MAP\n";
    for (let r = 1; r <= 20; r++) {
      let row = `${String(r).padStart(2, "0")} `;
      for (const l of ["A", "B", "C", "D", "E", "F"]) row += data.seatMap[`${r}${l}`] ? "[X]" : "[ ]";
      out += row + "\n";
    }
    return message.reply(out);
  }

  // !setvoyage
  if (content.startsWith("!setvoyage")) {
    if (channel !== "staff") return;
    const [_, from, to, length] = content.split(" ");
    activeVoyage = { id: voyageId++, from, to, length, captain: null, fo: null, gc: null, gcDeadline: Date.now() + ONE_DAY, salesOpen: false };
    return message.channel.send(`🚢 VOYAGE CREATED: ${from} → ${to}`);
  }

  // !claim
  if (content.startsWith("!claim")) {
    if (!activeVoyage) return message.reply("❌ No active voyage.");
    const role = content.split(" ")[1];
    if (role === "captain" && !activeVoyage.captain) { activeVoyage.captain = message.author.username; return message.reply("Captain claimed."); }
    if (role === "fo" && !activeVoyage.fo) { activeVoyage.fo = message.author.username; return message.reply("FO claimed."); }
    if (role === "gc" && !activeVoyage.gc) { activeVoyage.gc = message.author.username; return message.reply("GC claimed."); }
  }
});

// VOYAGE CHECKER
setInterval(async () => {
  if (!activeVoyage || activeVoyage.salesOpen) return;
  if (activeVoyage.captain && activeVoyage.fo) {
    activeVoyage.salesOpen = true;
    const ch = client.channels.cache.find(c => c.name === "voyages");
    if (ch) try { await ch.send("🚢 SALES NOW OPEN!"); } catch(e) { console.log(e); }
  }
}, 60000);

client.login(TOKEN);
