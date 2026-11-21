(() => {
  "use strict";

  const leaving = { x: 9.34, y: 2.22, pose: "standing" };
  const kitchen = { x: 6.3, y: 6.1, pose: "cook" };
  const scrolling = { x: 1.5, y: 6.13, pose: "phone" };
  const sofa = { x: 3.13, y: 6.24, pose: "standing" };
  const stories = {
    keys: {
      title: "Finding lost keys",
      description: "Recover a remembered location and guide the resident to it.",
      shots: [
        { title: "Ready to leave", direction: "The resident gets ready to leave and realises their keys are missing.", room: { actor: leaving } },
        { title: "Ask the companion", direction: "The resident turns to the device for help.", user: "Where are my keys?", room: { actor: leaving } },
        { title: "Recall the last location", direction: "The device checks a previously recorded observation.", assistant: "I last saw them near the living-room sofa.", room: { actor: leaving } },
        { title: "Move to the sofa", direction: "The carriage moves on the ceiling track and turns its view towards the sofa.", room: { target: "sofa", inspect: "sofa", actor: sofa } },
        { title: "Illuminate the keys", direction: "Once the device confirms the keys in the scene, a spotlight points to the floor beside the sofa.", assistant: "The keys are on the floor, beside the sofa.", room: { target: "sofa", spotlight: true, spotlightLocation: "sofa", actor: sofa } },
        { title: "Pick up the keys", direction: "The resident picks up the keys and the spotlight switches off.", room: { target: "sofa", keysCollected: true, actor: { ...sofa, pose: "collected" } } }
      ]
    },
    cooking: {
      title: "Cooking assistance",
      description: "Follow a spoken request to the kitchen and talk through the next step.",
      shots: [
        { title: "Hands are busy", direction: "The resident is working at the kitchen counter with their hands full.", room: { actor: kitchen } },
        { title: "Call the device", direction: "The resident speaks from the counter.", user: "Come to the kitchen. Help me cook.", room: { actor: kitchen } },
        { title: "Travel to the kitchen", direction: "The device glides along the ceiling rail and turns towards the worktop.", room: { actor: kitchen, target: "kitchen", inspect: "kitchen" } },
        { title: "Ask about the dish", direction: "The device looks at the ingredients and asks what the resident wants to make.", assistant: "I can see tomatoes on the counter. What are you making?", room: { actor: kitchen, target: "kitchen", inspect: "kitchen" } },
        { title: "Give the next step", direction: "The assistant gives a short instruction that the resident can follow hands-free.", user: "A tomato salad.", assistant: "Rinse the tomatoes and place them on the chopping board.", room: { actor: kitchen, target: "kitchen", inspect: "kitchen" } },
        { title: "Continue by voice", direction: "The resident keeps preparing the salad and asks their next question.", user: "What comes next?", assistant: "Slice the tomatoes and put them in the bowl.", room: { actor: kitchen, target: "kitchen", inspect: "kitchen" } }
      ]
    },
    bedtime: {
      title: "Privacy & bedtime",
      description: "A gentle reminder, a short snooze, and a physical privacy curtain.",
      shots: [
        { title: "Set a bedtime reminder", direction: "Earlier, the resident chose 11:00 pm and enabled a gentle bedtime reminder.", clock: "10:55 pm", room: { night: true, actor: scrolling } },
        { title: "Give a gentle reminder", direction: "The resident is still scrolling on their phone when the chosen time arrives.", assistant: "It’s 11 pm. Ready to wind down?", clock: "11:00 pm", room: { night: true, actor: scrolling } },
        { title: "Snooze for ten minutes", direction: "The assistant keeps the request and waits for the new time.", user: "Remind me again in ten minutes.", assistant: "Okay. I’ll remind you at 11:10 pm.", clock: "11:00 pm", room: { night: true, actor: scrolling } },
        { title: "Remind again", direction: "Ten simulated minutes later, the reminder returns and the resident decides to rest.", assistant: "It’s 11:10 pm, the time you chose to be reminded.", clock: "11:10 pm", room: { night: true, actor: scrolling } },
        { title: "Lower the privacy curtain", direction: "The motor lowers the curtain over the lens. Continue by manually lifting it the next morning.", user: "Close your camera.", assistant: "Camera off. The privacy curtain is down.", clock: "11:10 pm", room: { night: true, curtain: true, camera: false, actor: scrolling } },
        { title: "Reopen by hand", direction: "The next morning, the resident pushes the curtain up by hand. The camera is available again.", clock: "Next day · 8:00 am", room: { curtain: true, actor: { x: 5.6, y: 4.4, pose: "standing" } } }
      ]
    },
    exam: {
      title: "Smart exam reminder",
      description: "Skip a redundant wake-up reminder while keeping the exam scheduled.",
      shots: [
        { title: "Share the exam plan", direction: "The resident shares an exam message from their phone.", user: "I need to get up early for my exam tomorrow." },
        { title: "Save the exam and reminder", direction: "The app shows the exam and its wake-up reminder as separate entries." },
        { title: "Prepare to remind", direction: "The app approaches the scheduled wake-up time the next morning." },
        { title: "Observe that the resident is up", direction: "The simulated, enabled sensing mode reports that the resident is already awake." },
        { title: "Skip the wake-up reminder", direction: "The system skips the wake-up alert because the resident is already up." },
        { title: "Review the result", direction: "The app shows the skipped wake-up alert and the exam still scheduled for 9:00 am." }
      ]
    }
  };

  const $ = selector => document.querySelector(selector);
  const previous = $("#previous-shot");
  const next = $("#next-shot");
  const play = $("#play-story");
  const steps = $("#shot-steps");
  let story = "keys";
  let index = 0;
  let rail = "gantry";
  let playing = false;
  let timer;

  function manualGate() {
    return story === "bedtime" && index === 4;
  }

  function lastShot() {
    return stories[story].shots.length - 1;
  }

  function stop() {
    window.clearTimeout(timer);
    playing = false;
  }

  function schedule() {
    window.clearTimeout(timer);
    if (!playing) return;
    timer = window.setTimeout(() => go(index + 1), 3300);
  }

  function go(to, byHand = false) {
    if (to < 0 || to > lastShot() || (story === "bedtime" && to === 5 && !byHand)) return;
    index = to;
    if (index === lastShot() || manualGate()) stop();
    render();
    schedule();
  }

  function storyDialogue(shot) {
    const lines = $("#shot-lines");
    lines.replaceChildren();
    for (const [label, text, author] of [["Resident", shot.user, "user"], ["Companion", shot.assistant, "assistant"]]) {
      if (!text) continue;
      const card = document.createElement("div");
      card.className = "message " + author;
      const caption = document.createElement("small");
      caption.textContent = label;
      const quotation = document.createElement("p");
      quotation.textContent = "“" + text + "”";
      card.append(caption, quotation);
      lines.append(card);
    }
    lines.className = "story-dialogue";
  }

  function examPhone() {
    const clock = index <= 1 ? "Today · 8:24 pm" : index === 2 ? "Tomorrow · 6:59 am" : "Tomorrow · 7:00 am";
    const handoff = index === 0 ?
      '<div class="exam-entry share"><strong>Share to Companion</strong><p>I need to get up early for my exam tomorrow.</p></div>' : "";
    const exam = index > 0 ?
      '<div class="exam-entry" data-event="exam"><strong>Exam</strong><p>9:00 am · Scheduled</p></div>' : "";
    let reminder = "";
    if (index > 0) {
      const status = index >= 4 ? "Skipped — You're already awake." : index === 2 ? "Due in 1 minute" : "Scheduled";
      reminder = '<div class="exam-entry' + (index >= 4 ? " skipped" : "") + '" data-event="wake-up">' +
        '<strong>Wake-up reminder</strong><p>7:00 am · ' + status + '</p></div>';
    }
    const observed = index >= 3 ?
      '<div class="exam-entry"><strong>Awake check</strong><p>Already awake · Simulated sensing</p></div>' : "";
    return '<div class="exam-phone"><header><span>Companion</span><small>' + clock + '</small></header><div class="exam-body">' +
      handoff + exam + reminder + observed + '</div></div>';
  }

  function renderRoom(shot) {
    const isExam = story === "exam";
    $("#room-content").hidden = isExam;
    $("#exam-stage").hidden = !isExam;
    if (isExam) {
      $("#room-canvas").setAttribute("aria-hidden", "true");
      $("#exam-stage").innerHTML = examPhone();
      return;
    }
    const clock = $("#story-clock");
    clock.hidden = !shot.clock;
    clock.textContent = shot.clock || "";
    const room = {
      rail, camera: true, zones: [], target: "park", spotlight: false, doorOpen: false,
      story, ...shot.room
    };
    const mode = $("#story-camera");
    mode.classList.toggle("is-active", room.camera);
    mode.querySelector("span").textContent = room.camera ? "Camera on" : "Camera off";
    const shutter = $("#story-shutter");
    shutter.classList.toggle("is-active", room.camera);
    shutter.querySelector("span").textContent = room.camera ? "Privacy curtain up" : "Privacy curtain down";
    $("#story-track-key").textContent = rail === "gantry" ? "Y · Side rails" : "Ceiling track";
    $("#story-bridge-key").hidden = rail !== "gantry";
    for (const button of $("#story-rail").querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.railChoice === rail));
    }
    const canvas = $("#room-canvas");
    canvas.removeAttribute("aria-hidden");
    canvas.setAttribute("aria-label", shot.title + ". Camera " + (room.camera ? "on" : "off") +
      (room.spotlight ? ". Spotlight aimed beside the sofa." : ". Spotlight off."));
    window.companionRoom.show(room);
  }

  function render() {
    const data = stories[story];
    const shot = data.shots[index];
    $("#story-title").textContent = data.title;
    $("#story-description").textContent = data.description;
    $("#shot-number").textContent = "Shot " + (index + 1) + " of " + data.shots.length;
    $("#shot-title").textContent = shot.title;
    $("#shot-description").textContent = shot.direction;
    storyDialogue(shot);
    for (const button of $("#stories").querySelectorAll("button")) {
      if (button.dataset.story === story) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
    const activeStep = document.activeElement?.dataset.shot;
    steps.replaceChildren(...data.shots.map((entry, position) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.shot = position;
      button.textContent = position + 1;
      button.setAttribute("aria-label", "Shot " + (position + 1) + ", " + entry.title);
      if (position === index) button.setAttribute("aria-current", "step");
      if (story === "bedtime" && position === 5 && index !== 5) button.disabled = true;
      return button;
    }));
    if (activeStep) steps.querySelector('[data-shot="' + activeStep + '"]')?.focus();
    previous.disabled = index === 0;
    next.disabled = index === lastShot();
    next.textContent = manualGate() ? "Lift curtain by hand" : "Next shot";
    play.textContent = playing ? "Pause" : index === lastShot() ? "Replay" : "Play";
    play.disabled = manualGate();
    renderRoom(shot);
  }

  $("#stories").addEventListener("click", event => {
    const target = event.target.closest("[data-story]");
    if (!target || target.dataset.story === story) return;
    stop();
    story = target.dataset.story;
    index = 0;
    window.companionRoom.resetMotion();
    render();
  });
  $("#story-rail").addEventListener("click", event => {
    const target = event.target.closest("[data-rail-choice]");
    if (!target) return;
    rail = target.dataset.railChoice;
    render();
  });
  steps.addEventListener("click", event => {
    const target = event.target.closest("[data-shot]");
    if (!target) return;
    stop();
    go(Number(target.dataset.shot));
  });
  previous.addEventListener("click", () => { stop(); go(index - 1); });
  next.addEventListener("click", () => { stop(); go(index + 1, manualGate()); });
  play.addEventListener("click", () => {
    if (playing) stop();
    else {
      if (index === lastShot()) index = 0;
      playing = true;
    }
    render();
    schedule();
  });

  render();
})();
