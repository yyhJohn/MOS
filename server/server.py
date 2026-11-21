#!/usr/bin/env python3
"""Serve the authenticated MOS chat over a local nginx Unix socket."""
import http.client
import json
import logging
import os
import re
from hashlib import sha256
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from socketserver import ThreadingMixIn, UnixStreamServer
from threading import BoundedSemaphore
from urllib.parse import urlsplit

MAX_BODY = 32768
MAX_MESSAGES = 11
MAX_USER_CHARS = 1200
MAX_ASSISTANT_CHARS = 5600
ALLOWED_HOSTS = {"mos.hoyomax.me", "hoyomax.me", "www.hoyomax.me"}
ALLOWED_MODELS = {"gpt-6.2-terra", "gpt-6.1-terra", "gpt-6.2-sol"}
ITEMS = ("glasses", "umbrella", "keys", "backpack")
ITEM_ACTIONS = ("bring", "put_back")
MAX_ITEM_STEPS = 2 * len(ITEMS)
ROOM_TARGETS = (*ITEMS, "computer", "desk", "couch", "coffee_table", "front_door",
                "workspace", "living_area", "entryway", "private_zone", "resident")
LEGACY_ACTIONS = ("locate", "pick_up", "put_back", "stop")
ACTIONS = (*LEGACY_ACTIONS, "bring")
NAVIGATION_ACTIONS = (*ACTIONS, "look_at", "move_to")
DELIVERY_ACTIONS = (*ITEM_ACTIONS, "stop")
DELIVERY_REQUEST = re.compile(
    r"(?:(?:hey )?(?:mos|robin),? )?(?:please )?"
    r"(?:(?:can|could|would) you (?:please )?)?"
    r"(?:bring|give|hand|pass|fetch|get) me (?:the |my |an? )?([a-z]+)(?: please)?[.!?]*"
)
DELIVERY_QUEUE_TOOL = {
    "type": "function",
    "name": "queue_mos_deliveries",
    "description": "Hand multiple portable items to the resident one at a time, in the requested order.",
    "strict": True,
    "parameters": {
        "type": "object",
        "properties": {"items": {"type": "array", "items": {"type": "string", "enum": ITEMS},
                                 "minItems": 2, "maxItems": len(ITEMS),
                                 "description": "Distinct item IDs in the requested order, first item first."}},
        "required": ["items"],
        "additionalProperties": False,
    },
}
RETURN_QUEUE_TOOL = {
    **DELIVERY_QUEUE_TOOL,
    "name": "queue_mos_returns",
    "description": "Return each item from the resident or gripper to its original spot, in the requested order.",
}
MIXED_QUEUE_TOOL = {
    "type": "function",
    "name": "queue_mos_item_actions",
    "description": "Complete an ordered sequence that includes both handing items to the resident and returning items to their original spots.",
    "strict": True,
    "parameters": {
        "type": "object",
        "properties": {"steps": {
            "type": "array", "minItems": 2, "maxItems": MAX_ITEM_STEPS,
            "items": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ITEM_ACTIONS},
                    "item": {"type": "string", "enum": ITEMS},
                },
                "required": ["action", "item"],
                "additionalProperties": False,
            },
        }},
        "required": ["steps"],
        "additionalProperties": False,
    },
}
CAMERA_TOOL = {
    "type": "function",
    "name": "close_camera",
    "description": "Close the simulated camera shutter only when the latest user message directly asks for it.",
    "strict": True,
    "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False},
}
RAIN_REMINDER_TOOL = {
    "type": "function",
    "name": "set_rain_departure_reminder",
    "description": "Save a reminder for today if the demo forecast predicts rain and the character reaches the front door.",
    "strict": True,
    "parameters": {
        "type": "object",
        "properties": {"bring_umbrella": {"type": "boolean", "description": "Whether the user also asked for the umbrella to be handed to them."}},
        "required": ["bring_umbrella"],
        "additionalProperties": False,
    },
}
TIME_REMINDER_TOOL = {
    "type": "function",
    "name": "set_time_reminder",
    "description": "Set a reminder at a specific local time while the demo page is open.",
    "strict": True,
    "parameters": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Short reminder text in the user's language."},
            "time": {"type": "string", "description": "24-hour local time, HH:MM."},
            "day": {"type": "string", "enum": ["today", "tomorrow", "next"],
                    "description": "Use next when the user gives a time without specifying a day."},
        },
        "required": ["title", "time", "day"],
        "additionalProperties": False,
    },
}
INSTRUCTIONS = (
    "You are Robin, the assistant in the MOS home companion prototype. "
    "Answer in the user's language, naturally and briefly. "
    "You have no access to the user's real camera, devices, memories, calendar, or sensors. "
    "Use recent conversation turns supplied by the browser to answer follow-up questions. "
    "Only the user can open the simulated camera by operating the room shutter control. "
    "If asked to open or enable it, tell the user to click the shutter themselves. "
    "Never claim to have observed or acted in their real home."
)
ROOM_INSTRUCTIONS = (
    " The tool controls the simulated room only. Use it for a direct request to find or point at "
    "an item (locate), grab or pick up an item (pick_up, which lifts it into the gripper), "
    "return an item to its original position (put_back), or stop room motion (stop). "
    "Recognize 眼镜, 雨伞, 钥匙, 书包 and equivalent requests in other languages. "
    "Use the focused or held item to resolve a clear reference like 'it'; if ambiguous, ask which. "
    "Only call the tool on an actual request to act. The browser reports the real outcome, "
    "so use the tool itself, without claiming success or guessing an item's location."
)
DELIVERY_INSTRUCTIONS = (
    " For a request to bring, give, deliver, or hand an item to the resident, use bring. "
    "Treat these requests as actions in the simulated room, including at the front door. "
    "Examples: 把眼镜拿给我, 递给我钥匙, bring me my backpack, give me an umbrella. "
    "A request to simply pick up an item still uses pick_up. "
    "Use the item ID for bring, including when the gripper is already holding the requested item."
    " Use put_back when the user asks to put an item back, even if the resident is holding it. "
    "For example, when the resident has glasses, 把眼镜放回去 or put the glasses back requests "
    "put_back with item glasses. For a return request using 'it', resolve the item from the held item, "
    "the resident's items, or the conversation. Ask which if the reference is ambiguous."
)
DELIVERY_QUEUE_INSTRUCTIONS = (
    " Use queue_mos_deliveries when the latest message directly requests multiple handovers in the simulated room. "
    "For a plain list, keep the order mentioned: '给我钥匙和伞' means [keys, umbrella]. "
    "Explicit sequence or priority words override mention order: '钥匙和伞都给我，伞先拿' means [umbrella, keys], "
    "and '眼镜最后给我，先拿钥匙，再拿书包' means [keys, backpack, glasses]. "
    "Recognize 伞 as umbrella. Deduplicate repeated items while preserving the requested order. "
    "Use bring for one item. Ask if order is contradictory or the objects are ambiguous. "
    "Do not use this tool for reminders, negated instructions, or finding items without handing them over."
)
RETURN_QUEUE_INSTRUCTIONS = (
    " Use queue_mos_returns for explicit requests to put multiple items back in the simulated room. "
    "'先把伞放回去，再把钥匙放回去' means [umbrella, keys]. "
    "'钥匙和伞都放回去，伞先放' also means [umbrella, keys]. "
    "The plain list '把伞和钥匙放回去' means [umbrella, keys] in mention order. "
    "'把钥匙和伞放回去，钥匙最后放' means [umbrella, keys] because explicit order overrides mention order. "
    "Return steps finish one at a time. Use put_back for a single item. A request to deliver items "
    "to the resident is a separate action. Deduplicate repeated items. "
    "Do not queue negated requests, quoted examples, reminders, or conditional actions."
)
MIXED_QUEUE_INSTRUCTIONS = (
    " Use one queue_mos_item_actions call when the latest message explicitly asks for both handing over "
    "and putting back items. Keep the requested execution order, including any explicit priorities. "
    "'先把伞放回去，再把眼镜拿给我' means [put_back umbrella, bring glasses]. "
    "'先把眼镜给我，再把伞放回去' means [bring glasses, put_back umbrella]. "
    "Keep a repeated item when its requested action changes, for example bring an umbrella and then put it back. "
    "Each step represents the full handover or the full return to the original spot. "
    "Use the delivery-only or return-only tool for commands in just one direction if available. "
    "Do not use the mixed tool for quoted examples, conditions, reminders, or hypothetical actions."
)
NAVIGATION_INSTRUCTIONS = (
    " Room navigation also supports look_at to aim the lens from its current position, and move_to to "
    "travel to the nearest stop by a target. Use look_at for '你看向电脑' or 'turn toward the monitor'. "
    "Use locate for '找电脑在哪' or 'where is the computer?' to mark the known position. "
    "Use move_to for '移动到沙发旁' or 'come here', targeting couch and resident respectively. "
    "For '我在哪', '你知道我在哪吗', or 'where am I', use locate with resident. "
    "For '看向我', use look_at with resident. The browser knows the character's position from the map. "
    "Fixed targets: computer (电脑 or 显示器), desk (书桌), couch (沙发), coffee_table (茶几), "
    "front_door (门 or 大门), workspace (工作区 or 书桌区), living_area (客厅), entryway (玄关), "
    "private_zone (私人区). Resident is the user's character. Only the four portable items can be picked "
    "up, handed over, or put back. For a request to carry furniture, explain this briefly. "
    "The browser handles shutter state and movement permissions. Never infer what is displayed on the computer."
)
LOG = logging.getLogger("mos-ai")


def memory_profile(username):
    return sha256(("mos-browser-memory-v1\0" + username).encode()).hexdigest()


class RequestError(Exception):
    def __init__(self, status, code):
        self.status = status
        self.code = code


class HomeAssistantCurtain:
    def __init__(self, endpoint, token, entity, username):
        self.endpoint = endpoint
        self.token = token
        self.entity = entity
        self.username = username
        self.slot = BoundedSemaphore(1)

    @classmethod
    def from_environment(cls):
        url, token, entity, username = (os.environ.get(name, "") for name in (
            "MOS_HA_URL", "MOS_HA_TOKEN", "MOS_HA_CURTAIN", "MOS_HA_USER"))
        if not any((url, token, entity, username)):
            return None
        try:
            endpoint = urlsplit(url)
            loopback = endpoint.hostname in ("localhost", "127.0.0.1", "::1")
            if (not all((endpoint.hostname, token, username)) or endpoint.username is not None
                    or endpoint.password is not None or endpoint.path not in ("", "/")
                    or endpoint.query or endpoint.fragment or endpoint.port == 0
                    or not re.fullmatch(r"cover\.[a-z0-9_]+", entity)
                    or not (endpoint.scheme == "https" or endpoint.scheme == "http" and loopback)):
                raise ValueError
        except ValueError:
            LOG.warning("Home Assistant curtain is disabled because its configuration is incomplete or invalid")
            return None
        return cls(endpoint, token, entity, username)

    def close(self):
        if not self.slot.acquire(blocking=False):
            raise RequestError(429, "curtain_busy")
        connection_class = (http.client.HTTPSConnection if self.endpoint.scheme == "https"
                            else http.client.HTTPConnection)
        connection = connection_class(self.endpoint.hostname, self.endpoint.port, timeout=5)
        try:
            connection.request("POST", "/api/services/cover/close_cover",
                               json.dumps({"entity_id": self.entity}),
                               {"Authorization": "Bearer " + self.token, "Content-Type": "application/json"})
            if connection.getresponse().status != 200:
                raise RequestError(502, "curtain_service_error")
        except (OSError, ValueError, http.client.HTTPException):
            raise RequestError(502, "curtain_service_unconfirmed") from None
        finally:
            connection.close()
            self.slot.release()


def room_tool(actions, targets):
    return {
        "type": "function",
        "name": "control_mos",
        "description": "Request a movement in the simulated MOS room. The room checks permissions and performs it.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": actions},
                "item": {"type": "string", "enum": (*targets, ""),
                         "description": "Room target ID. Use an empty string for stop or to put the held item back."},
            },
            "required": ["action", "item"],
            "additionalProperties": False,
        },
    }


def parse_messages(body):
    try:
        content = json.loads(body)
    except (ValueError, UnicodeError):
        raise RequestError(400, "invalid_json") from None
    messages = content.get("messages") if isinstance(content, dict) else None
    if not isinstance(messages, list) or not (1 <= len(messages) <= MAX_MESSAGES) or len(messages) % 2 == 0:
        raise RequestError(400, "invalid_messages")
    normalized = []
    for index, message in enumerate(messages):
        role = "assistant" if index % 2 else "user"
        limit = MAX_ASSISTANT_CHARS if role == "assistant" else MAX_USER_CHARS
        if not isinstance(message, dict) or message.get("role") != role:
            raise RequestError(400, "invalid_role")
        text = message.get("content")
        if not isinstance(text, str) or not text.strip() or len(text) > limit:
            raise RequestError(400, "invalid_message")
        normalized.append({"role": role, "content": text.strip()})
    room = content.get("room")
    if room is not None:
        if not isinstance(room, dict) or room.keys() not in (
                {"held", "focused"}, {"held", "focused", "received"}, {"held", "focused", "received", "navigation"}):
            raise RequestError(400, "invalid_room")
        if "navigation" in room and room["navigation"] is not True:
            raise RequestError(400, "invalid_room")
        targets = ROOM_TARGETS if room.get("navigation") else ITEMS
        if room["held"] not in (*ITEMS, "") or room["focused"] not in (*targets, ""):
            raise RequestError(400, "invalid_room")
        received = room.get("received", [])
        if (not isinstance(received, list) or len(received) > len(ITEMS) or any(item not in ITEMS for item in received)
                or len(set(received)) != len(received) or room["held"] in received):
            raise RequestError(400, "invalid_room")
    camera_control = content.get("camera_control", False)
    reminder_control = content.get("reminder_control", False)
    delivery_queue = content.get("delivery_queue", False)
    return_queue = content.get("return_queue", False)
    mixed_item_queue = content.get("mixed_item_queue", False)
    if not all(isinstance(flag, bool) for flag in
               (camera_control, reminder_control, delivery_queue, return_queue, mixed_item_queue)):
        raise RequestError(400, "invalid_capability")
    return normalized, room, camera_control, reminder_control, delivery_queue, return_queue, mixed_item_queue


def is_umbrella_typo(word):
    target = "umbrella"
    if len(word) == len(target):
        changes = [i for i, (actual, expected) in enumerate(zip(word, target)) if actual != expected]
        if len(changes) == 1:
            return True
        if len(changes) == 2:
            left, right = changes
            return right == left + 1 and word[left:right + 1] == target[left:right + 1][::-1]
        return False
    longer, shorter = (word, target) if len(word) > len(target) else (target, word)
    return len(longer) == len(shorter) + 1 and any(
        longer[:i] + longer[i + 1:] == shorter for i in range(len(longer))
    )


def direct_delivery(text):
    match = DELIVERY_REQUEST.fullmatch(" ".join(text.lower().split()))
    if not match:
        return None
    word = match.group(1)
    if word in ITEMS:
        return word
    if word == "key":
        return "keys"
    if is_umbrella_typo(word):
        return "umbrella"
    return None


def ask_openai(key, model, messages, room, camera_control=False, reminder_control=False,
               delivery_queue=False, return_queue=False, mixed_item_queue=False):
    delivery = direct_delivery(messages[-1]["content"])
    if delivery:
        if room is not None and "received" in room:
            return {"command": {"action": "bring", "item": delivery}}
        return {"reply": "Open Free explore or Leaving home so I can use the room's gripper. "
                         "If you're already there, reload the page and ask again."}

    payload = {
        "model": model, "service_tier": "fast", "reasoning": {"effort": "low"},
        "instructions": INSTRUCTIONS, "input": messages, "store": False,
        "max_output_tokens": 900,
    }
    actions = ACTIONS if room is not None and "received" in room else LEGACY_ACTIONS
    has_inventory = room is not None and "received" in room
    can_queue = delivery_queue and has_inventory
    can_queue_returns = return_queue and has_inventory
    can_mix_items = mixed_item_queue and has_inventory
    targets = ITEMS
    tools = []
    if room is not None:
        payload["instructions"] += (ROOM_INSTRUCTIONS + f" Current simulation: held item "
                                    f"{room['held'] or 'none'}, focused item {room['focused'] or 'none'}.")
        if "received" in room:
            received = ", ".join(room["received"]) or "none"
            payload["instructions"] += DELIVERY_INSTRUCTIONS + f" Items currently with the resident: {received}."
        if room.get("navigation"):
            actions, targets = NAVIGATION_ACTIONS, ROOM_TARGETS
            payload["instructions"] += NAVIGATION_INSTRUCTIONS
        elif can_queue or can_queue_returns or can_mix_items:
            actions = DELIVERY_ACTIONS
            payload["instructions"] += (
                " In this scene only delivering, putting items back, and stopping movement are available. "
                "For other room movements, suggest Free exploration."
            )
        if can_queue:
            payload["instructions"] += DELIVERY_QUEUE_INSTRUCTIONS
            tools.append(DELIVERY_QUEUE_TOOL)
        if can_queue_returns:
            payload["instructions"] += RETURN_QUEUE_INSTRUCTIONS
            tools.append(RETURN_QUEUE_TOOL)
        if can_mix_items:
            payload["instructions"] += MIXED_QUEUE_INSTRUCTIONS
            tools.append(MIXED_QUEUE_TOOL)
        if not (can_queue or can_queue_returns or can_mix_items):
            payload["instructions"] += " Handle one item per request and ask which to start with if needed."
        tools.append(room_tool(actions, targets))
    if camera_control:
        payload["instructions"] += (
            " If the latest user message explicitly asks to close the camera or shutter, call close_camera. "
            "Do not call it for questions about the camera, quoted examples, conditional suggestions, "
            "or requests to leave the camera as is."
        )
        tools.append(CAMERA_TOOL)
    if reminder_control:
        payload["instructions"] += (
            " When the user asks to set today's conditional rain reminder for departure, call "
            "set_rain_departure_reminder. The character reaching the front door is the trigger. "
            "For '设置今天如果要下雨就出门前提醒带雨伞，并把伞给我，我在门边就代表要出门了', "
            "call set_rain_departure_reminder with bring_umbrella true, without trying to bring the umbrella now. "
            "When the user requests a reminder at a specified time, use set_time_reminder. "
            "Ask for a time if a timed reminder lacks one. Don't claim weather observations or promise reminders "
            "for unsupported conditions or dates. The browser uses its demo weather and local clock."
        )
        tools.extend([RAIN_REMINDER_TOOL, TIME_REMINDER_TOOL])
    if tools:
        payload.update(tools=tools, parallel_tool_calls=False)
    upstream = http.client.HTTPSConnection("api.openai.com", timeout=24)
    try:
        upstream.request("POST", "/v1/responses", body=json.dumps(payload).encode(), headers={
            "Authorization": "Bearer " + key, "Content-Type": "application/json",
            "Accept": "application/json",
        })
        response = upstream.getresponse()
        if response.status != 200:
            LOG.warning("OpenAI response HTTP %d", response.status)
            if response.status == 429:
                raise RequestError(429, "openai_limited")
            if response.status in (401, 403, 404):
                raise RequestError(503, "openai_unavailable")
            raise RequestError(502, "openai_error")
        data = json.loads(response.read(1024 * 1024))
    except TimeoutError:
        raise RequestError(504, "openai_timeout") from None
    except (OSError, ValueError, http.client.HTTPException):
        raise RequestError(502, "openai_error") from None
    finally:
        upstream.close()

    tier = data.get("service_tier")
    result = {"model": model,
              "service_tier": tier if tier in ("default", "fast", "priority", "flex", "scale", "ultrafast") else None}
    output = data.get("output", ())
    calls = [item for item in output if item.get("type") == "function_call"]
    if calls:
        if len(calls) != 1:
            raise RequestError(502, "invalid_room_command")
        try:
            command = json.loads(calls[0].get("arguments", ""))
        except (ValueError, TypeError):
            raise RequestError(502, "invalid_room_command") from None
        name = calls[0].get("name")
        if camera_control and name == "close_camera" and command == {}:
            return {**result, "command": {"action": "close_camera", "item": ""}}
        if can_mix_items and name == "queue_mos_item_actions":
            steps = command.get("steps") if isinstance(command, dict) and command.keys() == {"steps"} else None
            if (not isinstance(steps, list) or not 2 <= len(steps) <= MAX_ITEM_STEPS
                    or any(not isinstance(step, dict) or step.keys() != {"action", "item"}
                           or step["action"] not in ITEM_ACTIONS or step["item"] not in ITEMS for step in steps)
                    or len({step["action"] for step in steps}) != len(ITEM_ACTIONS)):
                raise RequestError(502, "invalid_item_queue")
            return {**result, "command": {"action": "queue_items", "steps": steps}}
        if ((can_queue and name == "queue_mos_deliveries")
                or (can_queue_returns and name == "queue_mos_returns")):
            ordered = command.get("items") if isinstance(command, dict) and command.keys() == {"items"} else None
            if (not isinstance(ordered, list) or not 2 <= len(ordered) <= len(ITEMS)
                    or any(item not in ITEMS for item in ordered) or len(set(ordered)) != len(ordered)):
                raise RequestError(502, "invalid_item_queue")
            action = "queue_return" if name == "queue_mos_returns" else "queue_delivery"
            return {**result, "command": {"action": action, "items": ordered}}
        if reminder_control and name in ("set_rain_departure_reminder", "set_time_reminder"):
            if not isinstance(command, dict):
                raise RequestError(502, "invalid_reminder_command")
            if name == "set_rain_departure_reminder":
                valid = command.keys() == {"bring_umbrella"} and isinstance(command["bring_umbrella"], bool)
            else:
                valid = (command.keys() == {"title", "time", "day"}
                         and isinstance(command["title"], str) and 0 < len(command["title"].strip()) <= 240
                         and isinstance(command["time"], str)
                         and re.fullmatch(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]", command["time"])
                         and command["day"] in ("today", "tomorrow", "next"))
            if not valid:
                raise RequestError(502, "invalid_reminder_command")
            return {**result, "command": {"action": name, **command}}
        if (room is None or name != "control_mos" or not isinstance(command, dict)
                or command.keys() != {"action", "item"}
                or command["action"] not in actions or command["item"] not in (*targets, "")
                or command["action"] in ("bring", "look_at", "move_to") and not command["item"]):
            raise RequestError(502, "invalid_room_command")
        return {**result, "command": command}

    parts = []
    for item in output:
        if item.get("type") != "message":
            continue
        for part in item.get("content", ()):
            if part.get("type") == "output_text":
                parts.append(part.get("text") or "")
            elif part.get("type") == "refusal":
                parts.append(part.get("refusal") or "")
    answer = "\n".join(part.strip() for part in parts if part.strip())[:MAX_ASSISTANT_CHARS]
    if not answer:
        raise RequestError(502, "empty_reply")
    return {**result, "reply": answer}


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *args):
        pass

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if self.path == "/connect":
            self.send_header("Vary", "Accept")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path != "/connect":
            self.send_json(404, {"error": "not_found"})
            return
        username = self.headers.get("X-MOS-User")
        if not username or self.headers.get("Host") not in ALLOWED_HOSTS:
            self.send_json(401, {"error": "auth_required"})
            return
        if self.headers.get("Accept") == "application/json":
            payload = {"profile": memory_profile(username)}
            if self.server.curtain and self.server.curtain.username == username:
                payload["curtain_connected"] = True
            self.send_json(200, payload)
            return
        self.send_response(303)
        self.send_header("Location", "../?ai=1")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Vary", "Accept")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        if self.path not in ("/chat", "/curtain"):
            self.send_json(404, {"error": "not_found"})
            return
        try:
            username = self.headers.get("X-MOS-User")
            if not username:
                raise RequestError(401, "auth_required")
            host = self.headers.get("Host")
            if host not in ALLOWED_HOSTS or self.headers.get("Origin") != "https://" + host:
                raise RequestError(403, "invalid_origin")
            profile = self.headers.get("X-MOS-Profile")
            if profile is not None and profile != memory_profile(username):
                raise RequestError(409, "profile_changed")
            if self.headers.get_content_type() != "application/json":
                raise RequestError(415, "invalid_content_type")
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise RequestError(400, "invalid_length") from None
            if not 0 < size <= MAX_BODY:
                raise RequestError(413, "request_too_large")
            if self.path == "/curtain":
                answer = self.close_curtain(username, profile, size)
            else:
                request = parse_messages(self.rfile.read(size))
                if not self.server.slots.acquire(blocking=False):
                    raise RequestError(429, "chat_busy")
                try:
                    answer = ask_openai(self.server.api_key, self.server.model, *request)
                finally:
                    self.server.slots.release()
        except RequestError as exc:
            self.send_json(exc.status, {"error": exc.code})
        else:
            self.send_json(200, answer)

    def close_curtain(self, username, profile, size):
        if not self.server.curtain or self.server.curtain.username != username or profile is None:
            raise RequestError(403, "curtain_not_available")
        if size != 2 or self.rfile.read(size) != b"{}":
            raise RequestError(400, "invalid_curtain_request")
        self.server.curtain.close()
        return {"accepted": True}


class Server(ThreadingMixIn, UnixStreamServer):
    daemon_threads = True

    def __init__(self, path, key, model):
        self.api_key, self.model = key, model
        self.slots = BoundedSemaphore(2)
        self.curtain = HomeAssistantCurtain.from_environment()
        super().__init__(path, Handler)

    def handle_error(self, request, client_address):
        LOG.warning("Local request handler closed with an error")


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    model = os.environ.get("OPENAI_MODEL")
    if model not in ALLOWED_MODELS:
        raise SystemExit("Configure an approved OPENAI_MODEL")
    key = (Path(os.environ["CREDENTIALS_DIRECTORY"]) / "openai-api-key").read_text().strip()
    if not key.startswith("sk-") or not key.isascii() or any(c.isspace() for c in key):
        raise SystemExit("OpenAI credential file is malformed")
    path = Path("/run/mos-ai/mos-ai.sock")
    path.unlink(missing_ok=True)
    with Server(str(path), key, model) as server:
        path.chmod(0o660)
        LOG.info("MOS AI listening. Model %s; Fast requested.", model)
        server.serve_forever()


if __name__ == "__main__":
    main()
