(() => {
  "use strict";

  const API_URL = "https://acnrouwnffgcofqicjjs.supabase.co/functions/v1/election-api";
  const slates = [
    { id: "coracoes", name: "Corações Avante", number: "01", symbol: "♥" },
    { id: "sociedade", name: "Sociedade Estudantil", number: "02", symbol: "✦" },
    { id: "revolucao", name: "Revolução Jovem", number: "03", symbol: "⚡" }
  ];
  const slateById = Object.fromEntries(slates.map(s => [s.id, s]));
  const cards = [...document.querySelectorAll("[data-slate]")];
  const confirmVoteButton = document.querySelector("#confirm-vote");
  const selectionStatus = document.querySelector("#selection-status");
  const confirmDialog = document.querySelector("#confirm-dialog");
  const passwordDialog = document.querySelector("#password-dialog");
  const resultsDialog = document.querySelector("#results-dialog");
  const successPanel = document.querySelector("#success-panel");
  let selectedSlate = null;
  let confirmedSlate = null;
  let pendingRequestId = null;
  let adminAction = "results";
  let adminPassword = "";
  let toastTimer;

  async function api(action, payload = {}) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": "sb_publishable_zBcH6s4BjrVYzBHryXqtng_Eug-0RXz" },
      body: JSON.stringify({ action, ...payload })
    });
    let data;
    try { data = await response.json(); } catch (_) { data = {}; }
    if (!response.ok) {
      const error = new Error(data.error || "request_failed");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
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
    } catch (_) {}
  }

  function makeRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  function clearSelection() {
    selectedSlate = null;
    confirmedSlate = null;
    pendingRequestId = null;
    cards.forEach(card => {
      card.disabled = false;
      card.setAttribute("aria-pressed", "false");
    });
    confirmVoteButton.disabled = true;
    selectionStatus.textContent = "Escolha uma chapa para continuar.";
  }

  cards.forEach(card => {
    card.addEventListener("click", () => {
      if (!successPanel.hidden) return;
      selectedSlate = slateById[card.dataset.slate] || null;
      cards.forEach(item => item.setAttribute("aria-pressed", String(item === card)));
      confirmVoteButton.disabled = !selectedSlate;
      selectionStatus.textContent = selectedSlate
        ? "Você selecionou: " + selectedSlate.name + ". Confirme quando estiver pronto."
        : "Escolha uma chapa para continuar.";
    });
  });

  confirmVoteButton.addEventListener("click", () => {
    if (!selectedSlate) return;
    confirmedSlate = selectedSlate;
    document.querySelector("#confirm-heading").textContent = "Confirmar " + selectedSlate.name + "?";
    document.querySelector("#confirm-copy").textContent = "Confira sua escolha. Depois da confirmação, o voto será registrado no sistema central.";
    confirmDialog.showModal();
  });

  document.querySelector("#final-confirm").addEventListener("click", async event => {
    event.preventDefault();
    if (!confirmedSlate || confirmVoteButton.dataset.sending === "true") return;
    if (!pendingRequestId) pendingRequestId = makeRequestId();
    const finalButton = document.querySelector("#final-confirm");
    finalButton.disabled = true;
    confirmVoteButton.dataset.sending = "true";
    try {
      await api("vote", { requestId: pendingRequestId, slateId: confirmedSlate.id });
      confirmDialog.close();
      playConfirmationSound();
      successPanel.hidden = false;
      selectionStatus.textContent = "Voto registrado no sistema central. Aguarde o fiscal liberar o próximo aluno.";
      confirmVoteButton.disabled = true;
      cards.forEach(card => { card.disabled = true; card.setAttribute("aria-pressed", "false"); });
      showToast("Voto registrado com sucesso!");
      confirmedSlate = null;
      pendingRequestId = null;
    } catch (error) {
      showToast(error.message === "Failed to fetch"
        ? "Não foi possível conectar ao servidor. Verifique a internet e tente novamente."
        : "Não foi possível registrar o voto. Tente novamente; não conte como registrado até aparecer a confirmação.");
    } finally {
      finalButton.disabled = false;
      confirmVoteButton.dataset.sending = "false";
    }
  });

  document.querySelector("#next-voter").addEventListener("click", () => {
    successPanel.hidden = true;
    clearSelection();
    document.querySelector("#vote-title").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function openAdminPrompt(action) {
    adminAction = action;
    adminPassword = "";
    document.querySelector("#password-title").textContent = action === "reset" ? "Resetar votação" : "Resultado da eleição";
    document.querySelector("#password-description").textContent = action === "reset"
      ? "Digite a senha administrativa para habilitar a limpeza dos votos."
      : "Digite a senha administrativa para consultar a apuração central.";
    document.querySelector("#password-submit").textContent = action === "reset" ? "Continuar" : "Ver resultado";
    document.querySelector("#admin-password").value = "";
    document.querySelector("#password-error").hidden = true;
    passwordDialog.showModal();
    setTimeout(() => document.querySelector("#admin-password").focus(), 50);
  }

  document.querySelector("#show-results").addEventListener("click", () => openAdminPrompt("results"));
  document.querySelector("#reset-votes").addEventListener("click", () => openAdminPrompt("reset"));
  document.querySelector("#cancel-password").addEventListener("click", () => passwordDialog.close());

  document.querySelector("#password-form").addEventListener("submit", async event => {
    event.preventDefault();
    const entered = document.querySelector("#admin-password").value;
    const submitButton = document.querySelector("#password-submit");
    submitButton.disabled = true;
    document.querySelector("#password-error").hidden = true;
    try {
      if (adminAction === "reset") {
        await api("results", { password: entered });
        adminPassword = entered;
        passwordDialog.close();
        const accepted = window.confirm("ATENÇÃO: isso apagará todos os votos da eleição em todos os dispositivos e não poderá ser desfeito. Exporte a apuração antes, se precisar guardá-la. Deseja realmente zerar a votação?");
        if (!accepted) {
          adminPassword = "";
          return;
        }
        const reset = await api("reset", { password: adminPassword, confirm: true });
        adminPassword = "";
        showToast("Votação zerada no banco central. Registros removidos: " + (reset.deleted ?? 0) + ".");
        return;
      }

      const result = await api("results", { password: entered });
      adminPassword = "";
      renderResults(result);
      passwordDialog.close();
      resultsDialog.showModal();
    } catch (error) {
      if (error.status === 401 || error.message === "invalid_admin_password") {
        document.querySelector("#password-error").hidden = false;
        document.querySelector("#admin-password").select();
      } else {
        showToast("Não foi possível concluir a ação administrativa. Verifique a conexão e tente novamente.");
      }
    } finally {
      submitButton.disabled = false;
    }
  });

  function getResultRows(result) {
    const map = Object.fromEntries((result.results || []).map(item => [item.id, Number(item.votes) || 0]));
    return slates.map(slate => ({ ...slate, votes: map[slate.id] || 0 }));
  }

  function renderResults(result) {
    const rows = getResultRows(result);
    const total = rows.reduce((sum, row) => sum + row.votes, 0);
    const list = document.querySelector("#results-list");
    list.replaceChildren();
    rows.forEach(slate => {
      const percent = total ? (slate.votes / total) * 100 : 0;
      const row = document.createElement("div");
      row.className = "result-row";
      const top = document.createElement("div");
      top.className = "result-row-top";
      const name = document.createElement("span");
      name.textContent = "Chapa " + slate.number + " · " + slate.name;
      const countEl = document.createElement("span");
      countEl.className = "result-count";
      countEl.textContent = slate.votes + " (" + percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%)";
      top.append(name, countEl);
      row.append(top);
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
    document.querySelector(".results-subtitle").textContent = "Apuração centralizada · atualizada no momento da consulta.";
    document.querySelector(".results-warning").textContent = "Os resultados são consultados no banco central e incluem votos enviados por todos os dispositivos conectados.";
  }

  document.querySelector("#close-results").addEventListener("click", () => resultsDialog.close());

  document.querySelector("#export-results").addEventListener("click", async () => {
    const password = window.prompt("Confirme a senha administrativa para exportar a apuração atual:");
    if (!password) return;
    try {
      const result = await api("results", { password });
      const rows = getResultRows(result);
      const total = rows.reduce((sum, row) => sum + row.votes, 0);
      const csvRows = [["Chapa", "Nome", "Votos", "Percentual"]];
      rows.forEach(s => csvRows.push([
        s.number,
        s.name,
        String(s.votes),
        total ? ((s.votes / total) * 100).toFixed(1).replace(".", ",") + "%" : "0%"
      ]));
      csvRows.push(["", "Total", String(total), total ? "100%" : "0%"]);
      const csv = "\uFEFF" + csvRows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "apuracao-gremio-estudantil.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (_) {
      showToast("Não foi possível exportar. Verifique a senha e a conexão.");
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") confirmedSlate = null;
  });
})();