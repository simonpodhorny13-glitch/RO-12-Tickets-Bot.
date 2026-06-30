function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const days = Math.floor(hr / 24);

  return `${days}d ${hr % 24}h ${min % 60}m`;
}

module.exports = {
  name: "profile",

  async execute(interaction, { data, voyages }) {
    const userId = interaction.user.id;
    const user = data.users[userId];

    if (!user) {
      return interaction.reply({
        content: "❌ No profile found.",
        ephemeral: true
      });
    }

    // ⏱️ time in server
    const timeHere = formatTime(Date.now() - user.firstSeen);

    // 🎫 recent bookings
    let recent = [];

    for (const v of Object.values(voys = voyages)) {
      if (v.cabinMap?.[userId]) {
        recent.push(`🚢 Voyage #${v.id} → Cabin ${v.cabinMap[userId]}`);
      }
      if (v.seatMap?.[userId]) {
        recent.push(`🚢 Voyage #${v.id} → Seat ${v.seatMap[userId]}`);
      }
    }

    recent = recent.slice(-5); // last 5 only

    return interaction.reply({
      embeds: [
        {
          title: "🪪 RO-12 Passenger Profile",
          color: 0x00aaff,
          fields: [
            {
              name: "👤 Username",
              value: interaction.user.username,
              inline: true
            },
            {
              name: "🎭 Role",
              value: "Passenger",
              inline: true
            },
            {
              name: "💰 Balance",
              value: `${user.balance ?? 0} credits`,
              inline: true
            },
            {
              name: "⏱️ In-server time",
              value: timeHere,
              inline: false
            },
            {
              name: "🎫 Recent bookings",
              value: recent.length
                ? recent.join("\n")
                : "No bookings yet",
              inline: false
            }
          ]
        }
      ]
    });
  }
};
