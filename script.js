(() => {
  "use strict";
  const STORAGE_KEY = "gremio-eleicao-votos-v1";
  const ADMIN_PASSWORD = "nsa019021";
  const slates = [
    { id: "coracoes", name: "Corações Avante", number: "01", symbol: "♥" },
    { id: "sociedade", name: "Sociedade Estudantil", number: "02", symbol: "✦" },
    { id: "revolucao", name: "Revolução Jovem", number: "03", symbol: "⚡" }
  ];
  const cards = [...document.querySelectorAll("[data-slate]")];
  const confirmVoteButton = document.querySelector("#confirm-vote");
  const selectionStatus = document.querySelector("#selection-status");
  const confirmDialog = document.querySelector("#confirm-dialog");
  const passwordDialog = document.querySelector("#password-dialog");
  const resultsDialog = document.querySelector("#results-dialog");
  const successPanel = document.querySelector("#success-panel");
  let selectedSlate = null;
  let confirmedSlate = null;
  let toastTimer;\n  let adminAction = "results";

  function readVotes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return Object.fromEntries(slates.map(s => [s.id, Number.isFinite(parsed[s.id]) && parsed[s.id] >= 0 ? Math.floor(parsed[s.id]) : 0]));
    } catch (_) {
      return Object.fromEntries(slates.map(s => [s.id, 0]));
    }
  }
  function saveVotes(votes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
  }
  function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
  }
  function playConfirmationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      [660, 880].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + index * 0.14 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.14 + 0.12);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(ctx.currentTime + index * 0.14);
        oscillator.stop(ctx.currentTime + index * 0.14 + 0.13);
      });
      setTimeout(() => ctx.close(), 700);
    } catch (_) {
      // Alguns navegadores bloqueiam áudio; a confirmação visual continua funcionando.
    }
  }
  function clearSelection() {
    selectedSlate = null;
    cards.forEach(card => card.setAttribute("aria-pressed", "false"));
    confirmVoteButton.disabled = true;
    selectionStatus.textContent = "Escolha uma chapa para continuar.";
  }
  cards.forEach(card => {
    card.addEventListener("click", () => {
      if (!successPanel.hidden) return;
      selectedSlate = slates.find(s => s.id === card.dataset.slate) || null;
      cards.forEach(item => item.setAttribute("aria-pressed", String(item === card)));
      confirmVoteButton.disabled = !selectedSlate;
      selectionStatus.textContent = selectedSlate ? "Você selecionou: " + selectedSlate.name + ". Confirme quando estiver pronto." : "Escolha uma chapa para continuar.";
    });
  });
  confirmVoteButton.addEventListener("click", () => {
    if (!selectedSlate) return;
    confirmedSlate = selectedSlate;
    document.querySelector("#confirm-heading").textContent = "Confirmar " + selectedSlate.name + "?";
    document.querySelector("#confirm-copy").textContent = "Confira sua escolha. Depois da confirmação, o voto será registrado e não poderá ser alterado.";
    confirmDialog.showModal();
  });
  document.querySelector("#final-confirm").addEventListener("click", event => {
    event.preventDefault();
    if (!confirmedSlate) return;
    const votes = readVotes();
    votes[confirmedSlate.id] += 1;
    try {
      saveVotes(votes);
    } catch (_) {
      showToast("Não foi possível salvar neste navegador. Verifique as configurações.");
      confirmDialog.close();
      return;
    }
    confirmDialog.close();
    playConfirmationSound();
    successPanel.hidden = false;
    selectionStatus.textContent = "Voto registrado. Aguarde o fiscal liberar o próximo aluno.";
    confirmVoteButton.disabled = true;
    cards.forEach(card => { card.disabled = true; card.setAttribute("aria-pressed", "false"); });
    showToast("Voto registrado com sucesso!");
    confirmedSlate = null;
  });
  document.querySelector("#next-voter").addEventListener("click", () => {
    successPanel.hidden = true;
    cards.forEach(card => { card.disabled = false; });
    clearSelection();
    document.querySelector("#vote-title").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelector("#show-results").addEventListener("click", () => {
    document.querySelector("#admin-password").value = "";
    document.querySelector("#password-error").hidden = true;
    passwordDialog.showModal();
    setTimeout(() => document.querySelector("#admin-password").focus(), 50);
  });
  document.querySelector("#cancel-password").addEventListener("click", () => passwordDialog.close());
  document.querySelector("#password-form").addEventListener("submit", event => {
    event.preventDefault();
    const entered = document.querySelector("#admin-password").value;
    if (entered !== ADMIN_PASSWORD) {
      document.querySelector("#password-error").hidden = false;
      document.querySelector("#admin-password").select();
      return;
    }
    passwordDialog.close();
    renderResults();
    resultsDialog.showModal();
  });
  function renderResults() {
    const votes = readVotes();
    const total = Object.values(votes).reduce((sum, count) => sum + count, 0);
    const list = document.querySelector("#results-list");
    list.replaceChildren();
    slates.forEach(slate => {
      const count = votes[slate.id] || 0;
      const percent = total ? (count / total) * 100 : 0;
      const row = document.createElement("div");
      row.className = "result-row";
      const top = document.createElement("div");
      top.className = "result-row-top";
      const name = document.createElement("span");
      name.textContent = "Chapa " + slate.number + " · " + slate.name;
      const countEl = document.createElement("span");
      countEl.className = "result-count";
      countEl.textContent = count + " (" + percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%)";
      top.append(name);
      row.append(top, countEl);
      const track = document.createElement("div");
      track.className = "result-track";
      const fill = document.createElement("div");
      fill.className = "result-fill";
      fill.style.width = percent + "%";
      track.append(fill);
      row.append(track);
      list.append(row);
    });
    document.querySelector("#total-votes").textContent = String(total);
  }
  document.querySelector("#close-results").addEventListener("click", () => resultsDialog.close());
  document.querySelector("#export-results").addEventListener("click", () => {
    const votes = readVotes();
    const total = Object.values(votes).reduce((sum, count) => sum + count, 0);
    const rows = [["Chapa", "Nome", "Votos", "Percentual"]];
    slates.forEach(s => rows.push([s.number, s.name, String(votes[s.id]), total ? ((votes[s.id] / total) * 100).toFixed(1).replace(".", ",") + "%" : "0%"]));
    rows.push(["", "Total", String(total), "100%"]);
    const csv = "\uFEFF" + rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "apuracao-gremio-estudantil.csv";
    link.click();
    URL.revokeObjectURL(url);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      confirmedSlate = null;
    }
  });
})();