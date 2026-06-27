const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("RO-12 bot is alive"));
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.TOKEN;
let data = loadData();
let activeVoyage = null;
let voyageId = 1;
const ONE_DAY = 24 * 60 * 60 * 1000;

function loadData() {
  try {
    if (!fs.existsSync("data.json")) return { users: {}, seatMap: {}, cabinMap: {} };
    return JSON.parse(fs.readFileSync("data.json", "utf8"));
  } catch (e) { return { users: {}, seatMap: {}, cabinMap: {} }; }
}

function saveData() { fs.writeFileSync("data.json", JSON.stringify(data, null, 2)); }
function getUser(id) {
  if (!data.users[id]) { data.users[id] = { balance: 250, seat: null, cabin: null }; saveData(); }
  return data.users[id];
}
function isValidSeat(seat) { return /^([1-9]|1[0-9]|20)([A-F])$/.test(seat); }
function getRouteData(code) {
  if (code === "1") return { name: "Short", multiplier: 1 };
  if (code === "2") return { name: "Medium", multiplier: 1.5 };
  if (code === "3") return { name: "Long", multiplier: 2 };
  return { name: "Unknown", multiplier: 1 };
}

client.once("ready", () => console.log(`Logged in as ${client.user.tag}`));

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const user = getUser(message.author.id);
  const content = message.content;
  const channel = message.channel.name;

  // !setvoyage
  if (content.startsWith("!setvoyage")) {
    if (channel !== "staff") return;
    const [_, from, to, length] = content.split(" ");
    const route = getRouteData(length);
    activeVoyage = { id: voyageId++, from, to, length: route.name, multiplier: route.multiplier, ship: "RO-12", captain: null, fo: null, gc: null, departure: "27th June", salesOpen: false };
    return message.channel.send(`🚢 VOYAGE CREATED: ${from} → ${to} (${route.name})`);
  }

  // !claim
  if (content.startsWith("!claim")) {
    if (!activeVoyage) return message.reply("❌ No active voyage.");
    const role = content.split(" ")[1];
    if (role === "captain") activeVoyage.captain = message.author.username;
    else if (role === "fo") activeVoyage.fo = message.author.username;
    else if (role === "gc") activeVoyage.gc = message.author.username;
    else return;
    message.reply(`${role} claimed.`);

    if (activeVoyage.captain && activeVoyage.fo && !activeVoyage.salesOpen) {
      activeVoyage.salesOpen = true;
      const ch = client.channels.cache.find(c => c.name === "voyages");
      if (ch) {
        ch.send({ embeds: [{
          color: 0x0099ff, title: "🚢 NEW VOYAGE SALES OPEN",
          fields: [
            { name: "From", value: activeVoyage.from, inline: true },
            { name: "To", value: activeVoyage.to, inline: true },
            { name: "Ship", value: activeVoyage.ship, inline: false },
            { name: "Captain", value: activeVoyage.captain, inline: true },
            { name: "F/O", value: activeVoyage.fo, inline: true },
            { name: "GC", value: activeVoyage.gc || "None", inline: true },
            { name: "Departing", value: activeVoyage.departure, inline: true },
            { name: "Route", value: activeVoyage.length, inline: true },
            { name: "Price", value: `$${50 * activeVoyage.multiplier}`, inline: true }
          ]
        }]});
      }
    }
  }

  // !seat
  if (content.startsWith("!seat")) {
    if (!activeVoyage || !activeVoyage.salesOpen) return message.reply("❌ Sales not open yet.");
    if (user.seat) return message.reply(`❌ You already have a seat: ${user.seat}`);
    const seat = content.split(" ")[1];
    const price = 50 * activeVoyage.multiplier;
    if (!isValidSeat(seat)) return message.reply("❌ Invalid seat (1A–20F)");
    if (data.seatMap[seat]) return message.reply("❌ Seat already taken.");
    if (user.balance < price) return message.reply(`❌ Not enough money! (Price: $${price})`);
    user.balance -= price; data.seatMap[seat] = message.author.id; user.seat = seat; saveData();
    return message.reply(`💺 Seat booked: ${seat} for $${price}.`);
  }

  // !cancel
  if (content === "!cancel") {
    if (!user.seat) return message.reply("❌ Nothing to cancel.");
    delete data.seatMap[user.seat]; user.seat = null; user.balance += 40; saveData();
    return message.reply("✅ Booking cancelled. ($40 refunded)");
  }
});

client.login(TOKEN);
