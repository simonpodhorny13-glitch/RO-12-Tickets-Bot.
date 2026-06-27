const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("RO-12 bot is alive"));
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;
let data = loadData();
let activeVoyage = null;
let voyageId = 1;

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

function sendVoyageEmbed(client) {
  if (!activeVoyage || activeVoyage.salesOpen) return;
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

client.once("ready", () => console.log(`Logged in as ${client.user.tag}`));

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const user = getUser(message.author.id);
  const content = message.content;
  const channel = message.channel.name;

  const hasPermission = message.member?.roles.cache.some(r => ["Owner", "Admin", "Captain"].includes(r.name));

  if (content === "!balance") return message.reply(`💰 Your balance: $${user.balance}`);

  if (content === "!map cabins") {
    const isTaken = (id) => data.cabinMap[id] ? "[X]" : "[ ]";
    const mapMsg = `🛏️ **CABINS**\n\n**ECONOMY**\n1A ${isTaken("1A")}\n1B ${isTaken("1B")}\n2A ${isTaken("2A")}\n2B ${isTaken("2B")}\n\n**FIRST**\n1C ${isTaken("1C")}\n1D ${isTaken("1D")}\n2C ${isTaken("2C")}\n2D ${isTaken("2D")}\n\n**DOUBLE**\n3A ${isTaken("3A")}\n3B ${isTaken("3B")}\n3C ${isTaken("3C")}\n3D ${isTaken("3D")}`;
    return message.channel.send(mapMsg);
  }

  if (content.startsWith("!bookcabin")) {
    if (!activeVoyage) return message.reply("❌ No active voyage.");
    const cabin = content.split(" ")[1];
    if (!cabin) return message.reply("❌ Use: !bookcabin 1A");
    if (data.cabinMap[cabin]) return message.reply("❌ This cabin is taken.");
    
    const basePrice = 50 * activeVoyage.multiplier;
    const isFirstClass = ["1C", "1D", "2C", "2D"].includes(cabin);
    const price = isFirstClass ? (basePrice * 3) : basePrice;

    if (user.balance < price) return message.reply(`❌ Not enough money! (Price: $${price})`);
    
    user.balance -= price; 
    data.cabinMap[cabin] = message.author.id; 
    user.cabin = cabin; 
    saveData();
    return message.reply(`🛏️ Cabin ${cabin} booked for $${price}!`);
  }

  if (content.startsWith("!cancelvoyage")) {
    if (!hasPermission) return message.reply("❌ You don't have permission to cancel voyages.");
    if (!activeVoyage) return message.reply("❌ No active voyage to cancel.");
    const reason = content.split("!cancelvoyage ")[1] || "No reason provided.";
    const chVoyages = client.channels.cache.find(c => c.name === "voyages");
    const chStaff = client.channels.cache.find(c => c.name === "staff");
    const cancelMsg = `🚫 VOYAGE CANCELLED\nReason: ${reason}`;
    if (chVoyages) chVoyages.send(cancelMsg);
    if (chStaff) chStaff.send(cancelMsg);
    activeVoyage = null;
    data.seatMap = {}; data.cabinMap = {};
    for (let id in data.users) { data.users[id].seat = null; data.users[id].cabin = null; }
    saveData();
    return;
  }

  if (content.startsWith("!setvoyage")) {
    if (channel !== "staff") return;
    const [_, from, to, length] = content.split(" ");
    const route = getRouteData(length);
    activeVoyage = { id: voyageId++, from, to, length: route.name, multiplier: route.multiplier, ship: "RO-12", captain: null, fo: null, gc: null, departure: "27th June", salesOpen: false, timerSet: false };
    return message.channel.send(`🚢 VOYAGE CREATED: ${from} → ${to} (${route.name})`);
  }

  if (content.startsWith("!claim")) {
    if (!activeVoyage) return message.reply("❌ No active voyage.");
    const role = content.split(" ")[1];
    if (role === "captain") activeVoyage.captain = message.author.username;
    else if (role === "fo") activeVoyage.fo = message.author.username;
    else if (role === "gc") activeVoyage.gc = message.author.username;
    else return;
    message.reply(`${role} claimed.`);
    if (activeVoyage.captain && activeVoyage.fo && activeVoyage.gc && !activeVoyage.salesOpen) {
      sendVoyageEmbed(client);
    } else if (activeVoyage.captain && activeVoyage.fo && !activeVoyage.salesOpen && !activeVoyage.timerSet) {
      activeVoyage.timerSet = true;
      message.channel.send("⏳ GC missing. Sales will open in 24 hours if GC is not found.");
      setTimeout(() => { if (activeVoyage && !activeVoyage.salesOpen) sendVoyageEmbed(client); }, 24 * 60 * 60 * 1000);
    }
  }

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

  if (content === "!cancel") {
    if (!user.seat && !user.cabin) return message.reply("❌ Nothing to cancel.");
    let refund = 0;
    if (user.seat) { 
        refund += Math.floor((50 * activeVoyage.multiplier) * 0.9);
        delete data.seatMap[user.seat]; user.seat = null; 
    }
    if (user.cabin) { 
        const basePrice = 50 * activeVoyage.multiplier;
        const price = ["1C", "1D", "2C", "2D"].includes(user.cabin) ? (basePrice * 3) : basePrice;
        refund += Math.floor(price * 0.9);
        delete data.cabinMap[user.cabin]; user.cabin = null; 
    }
    user.balance += refund;
    saveData();
    return message.reply(`✅ Booking cancelled. Refund: $${refund} (90% of price)`);
  }
});

client.login(TOKEN);
