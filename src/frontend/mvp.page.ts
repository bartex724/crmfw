export function renderMvpPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CRM Warehouse MVP</title>
  <style>
    :root {
      --bg: #f4f6f8;
      --panel: #ffffff;
      --ink: #1e293b;
      --muted: #52606d;
      --brand: #0b7285;
      --brand-2: #087f5b;
      --line: #d9e2ec;
      --danger: #c92a2a;
      --ok: #2b8a3e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 0 0, #d8f3ff 0, transparent 36%),
        radial-gradient(circle at 100% 100%, #d3f9d8 0, transparent 35%),
        var(--bg);
    }
    .wrap { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }
    .brand { font-size: 24px; font-weight: 700; letter-spacing: 0.2px; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px;
      box-shadow: 0 8px 20px rgba(16, 24, 40, 0.06);
    }
    .grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    input, select, textarea, button {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 9px 10px;
      font: inherit;
      background: #fff;
    }
    textarea { min-height: 82px; resize: vertical; }
    button {
      background: var(--brand);
      color: #fff;
      border: none;
      cursor: pointer;
      transition: transform .08s ease, opacity .08s ease;
    }
    button:hover { opacity: 0.94; }
    button:active { transform: translateY(1px); }
    button.secondary { background: #334e68; }
    button.ghost { background: #e8f1f5; color: #102a43; }
    button.danger { background: var(--danger); }
    .nav {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 10px 0 14px;
    }
    .nav button.active { background: var(--brand-2); }
    .status {
      margin: 10px 0 14px;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 14px;
      border: 1px solid var(--line);
      background: #f8fafc;
    }
    .status.ok { border-color: #b7e4c7; background: #ebfbee; color: #1b4332; }
    .status.err { border-color: #ffc9c9; background: #fff5f5; color: #7f1d1d; }
    .hidden { display: none; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      text-align: left;
      border-bottom: 1px solid var(--line);
      padding: 8px 6px;
      vertical-align: top;
    }
    .inline {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .inline > * { width: auto; }
    .kpi {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      color: #334155;
      background: #f8fafc;
      margin-right: 6px;
      margin-bottom: 6px;
    }
    @media (max-width: 740px) {
      .wrap { padding: 12px; }
      .top { align-items: flex-start; flex-direction: column; }
      .panel { padding: 10px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">Warehouse CRM MVP</div>
      <div id="whoami" class="panel hidden"></div>
    </div>

    <div id="status" class="status hidden"></div>

    <section id="loginSection" class="panel">
      <h3>Sign In</h3>
      <div class="grid">
        <div>
          <label>Email</label>
          <input id="loginEmail" type="email" placeholder="admin@example.com" />
        </div>
        <div>
          <label>Password</label>
          <input id="loginPassword" type="password" placeholder="********" />
        </div>
      </div>
      <div class="inline" style="margin-top: 10px;">
        <button id="loginBtn" style="max-width: 220px;">Login</button>
      </div>
    </section>

    <section id="appSection" class="hidden">
      <div class="panel">
        <div class="inline" style="justify-content: space-between;">
          <div class="nav" id="tabs">
            <button data-tab="inventory" class="active">Inventory</button>
            <button data-tab="events">Events</button>
            <button data-tab="boxes">Boxes</button>
          </div>
          <div class="inline">
            <button id="refreshAll" class="ghost">Refresh</button>
            <button id="logoutBtn" class="secondary">Logout</button>
          </div>
        </div>
      </div>

      <section id="tab-inventory" class="tab panel">
        <h3>Inventory</h3>
        <div class="grid">
          <div class="panel">
            <h4>Create Category</h4>
            <label>Name</label>
            <input id="catName" />
            <label>Description</label>
            <input id="catDesc" />
            <button id="createCategoryBtn" style="margin-top: 10px;">Add Category</button>
          </div>

          <div class="panel">
            <h4>Create Item</h4>
            <label>Name</label>
            <input id="itemName" />
            <label>Code (optional)</label>
            <input id="itemCode" />
            <label>Category</label>
            <select id="itemCategory"></select>
            <label>Quantity</label>
            <input id="itemQty" type="number" min="0" value="0" />
            <label>Notes</label>
            <input id="itemNotes" />
            <button id="createItemBtn" style="margin-top: 10px;">Add Item</button>
          </div>
        </div>

        <div class="grid" style="margin-top: 12px;">
          <div class="panel">
            <h4>Categories</h4>
            <table>
              <thead><tr><th>Name</th><th>Description</th></tr></thead>
              <tbody id="categoryRows"></tbody>
            </table>
          </div>
          <div class="panel">
            <h4>Items</h4>
            <table>
              <thead><tr><th>Name</th><th>Code</th><th>Qty</th><th>Category</th></tr></thead>
              <tbody id="itemRows"></tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="tab-events" class="tab panel hidden">
        <h3>Events</h3>
        <div class="grid">
          <div class="panel">
            <h4>Create Event</h4>
            <label>Name</label>
            <input id="eventName" />
            <label>Date</label>
            <input id="eventDate" type="date" />
            <label>Location</label>
            <input id="eventLocation" />
            <label>Notes</label>
            <input id="eventNotes" />
            <button id="createEventBtn" style="margin-top: 10px;">Add Event</button>
          </div>

          <div class="panel">
            <h4>Events List</h4>
            <table>
              <thead><tr><th>Name</th><th>Date</th><th>Status</th><th></th></tr></thead>
              <tbody id="eventRows"></tbody>
            </table>
          </div>
        </div>

        <div id="eventDetail" class="panel hidden" style="margin-top: 12px;">
          <h4 id="eventTitle">Event Detail</h4>
          <div id="eventKpis"></div>
          <div class="grid">
            <div class="panel">
              <h5>Add Item To Event</h5>
              <label>Item</label>
              <select id="eventItemSelect"></select>
              <label>Planned Quantity</label>
              <input id="eventItemQty" type="number" min="1" value="1" />
              <button id="addEventItemBtn" style="margin-top: 10px;">Add To Event</button>
            </div>
            <div class="panel">
              <h5>Exports</h5>
              <div class="inline">
                <button id="downloadPacking" class="ghost">Packing List XLSX</button>
                <button id="downloadReport" class="ghost">Post-event XLSX</button>
              </div>
            </div>
          </div>
          <div class="panel" style="margin-top: 10px;">
            <h5>Event Items</h5>
            <table>
              <thead><tr><th>Item</th><th>Planned</th><th>Status</th><th>Change</th></tr></thead>
              <tbody id="eventItemRows"></tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="tab-boxes" class="tab panel hidden">
        <h3>Boxes</h3>
        <div class="grid">
          <div class="panel">
            <h4>Create Box</h4>
            <label>Code</label>
            <input id="boxCode" />
            <label>Name</label>
            <input id="boxName" />
            <label>Notes</label>
            <input id="boxNotes" />
            <button id="createBoxBtn" style="margin-top: 10px;">Add Box</button>
          </div>
          <div class="panel">
            <h4>Boxes List</h4>
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Notes</th></tr></thead>
              <tbody id="boxRows"></tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  </div>

  <script>
    const state = {
      user: null,
      categories: [],
      items: [],
      events: [],
      boxes: [],
      selectedEventId: null,
      selectedEvent: null,
      selectedEventItems: [],
      selectedEventStatusCounts: {}
    };

    function byId(id) { return document.getElementById(id); }

    function showStatus(message, type) {
      const node = byId('status');
      node.textContent = message;
      node.className = 'status ' + (type === 'err' ? 'err' : 'ok');
      node.classList.remove('hidden');
    }

    async function api(path, options) {
      const response = await fetch(path, Object.assign({ credentials: 'include' }, options || {}));
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.text();
      if (!response.ok) {
        const msg = typeof payload === 'string' ? payload : (payload.message || response.statusText);
        throw new Error(msg);
      }
      return payload;
    }

    function setAppVisible(isLogged) {
      byId('loginSection').classList.toggle('hidden', isLogged);
      byId('appSection').classList.toggle('hidden', !isLogged);
      byId('whoami').classList.toggle('hidden', !isLogged);
      if (isLogged && state.user) {
        byId('whoami').textContent = state.user.email + ' (' + state.user.role + ')';
      }
    }

    function wireTabs() {
      document.querySelectorAll('#tabs button').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const tab = btn.getAttribute('data-tab');
          document.querySelectorAll('#tabs button').forEach(function(x) { x.classList.remove('active'); });
          btn.classList.add('active');
          document.querySelectorAll('.tab').forEach(function(node) { node.classList.add('hidden'); });
          byId('tab-' + tab).classList.remove('hidden');
        });
      });
    }

    function renderCategories() {
      byId('categoryRows').innerHTML = state.categories.map(function(c) {
        return '<tr><td>' + (c.name || '-') + '</td><td>' + (c.description || '') + '</td></tr>';
      }).join('');
      byId('itemCategory').innerHTML = state.categories.map(function(c) {
        return '<option value="' + c.id + '">' + c.name + '</option>';
      }).join('');
    }

    function renderItems() {
      byId('itemRows').innerHTML = state.items.map(function(item) {
        const cat = item.category && item.category.name ? item.category.name : (item.categoryName || '');
        return '<tr><td>' + (item.name || '-') + '</td><td>' + (item.code || '-') + '</td><td>' + (item.quantity ?? 0) + '</td><td>' + cat + '</td></tr>';
      }).join('');
      byId('eventItemSelect').innerHTML = state.items.map(function(i) {
        return '<option value="' + i.id + '">' + i.name + ' (' + (i.quantity ?? 0) + ')</option>';
      }).join('');
    }

    function renderEvents() {
      byId('eventRows').innerHTML = state.events.map(function(event) {
        return '<tr>' +
          '<td>' + (event.name || '-') + '</td>' +
          '<td>' + String(event.eventDate || '').slice(0, 10) + '</td>' +
          '<td>' + (event.lifecycleStatus || '-') + '</td>' +
          '<td><button class="ghost" data-open-event="' + event.id + '">Open</button></td>' +
        '</tr>';
      }).join('');
      document.querySelectorAll('[data-open-event]').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          state.selectedEventId = btn.getAttribute('data-open-event');
          await refreshSelectedEvent();
        });
      });
    }

    function renderBoxes() {
      byId('boxRows').innerHTML = state.boxes.map(function(box) {
        return '<tr><td>' + (box.boxCode || '-') + '</td><td>' + (box.name || '-') + '</td><td>' + (box.notes || '') + '</td></tr>';
      }).join('');
    }

    function renderSelectedEvent() {
      const wrap = byId('eventDetail');
      if (!state.selectedEvent) {
        wrap.classList.add('hidden');
        return;
      }
      wrap.classList.remove('hidden');
      byId('eventTitle').textContent = 'Event Detail: ' + state.selectedEvent.name;
      byId('eventKpis').innerHTML = Object.keys(state.selectedEventStatusCounts || {}).map(function(key) {
        return '<span class="kpi">' + key + ': ' + state.selectedEventStatusCounts[key] + '</span>';
      }).join('');

      byId('eventItemRows').innerHTML = state.selectedEventItems.map(function(row) {
        const itemName = row.item && row.item.name ? row.item.name : row.itemName || row.itemId || '-';
        const selectId = 'status-' + row.id;
        const options = ['TO_PACK', 'PACKED', 'RETURNED', 'LOSS'].map(function(st) {
          const selected = st === row.status ? ' selected' : '';
          return '<option value="' + st + '"' + selected + '>' + st + '</option>';
        }).join('');
        return '<tr>' +
          '<td>' + itemName + '</td>' +
          '<td>' + (row.plannedQuantity ?? 0) + '</td>' +
          '<td>' + (row.status || '-') + '</td>' +
          '<td class="inline">' +
            '<select id="' + selectId + '">' + options + '</select>' +
            '<button class="ghost" data-status-item="' + row.id + '">Save</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      document.querySelectorAll('[data-status-item]').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          const eventItemId = btn.getAttribute('data-status-item');
          const next = byId('status-' + eventItemId).value;
          await api('/events/' + state.selectedEventId + '/items/' + eventItemId + '/status', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status: next })
          });
          showStatus('Item status updated.', 'ok');
          await refreshSelectedEvent();
        });
      });
    }

    async function refreshCategories() {
      const data = await api('/inventory/categories');
      state.categories = data.categories || [];
      renderCategories();
    }

    async function refreshItems() {
      const data = await api('/inventory/items?layout=compact');
      state.items = data.items || [];
      renderItems();
    }

    async function refreshEvents() {
      const data = await api('/events');
      state.events = data.events || [];
      renderEvents();
    }

    async function refreshBoxes() {
      const data = await api('/boxes');
      state.boxes = data.boxes || [];
      renderBoxes();
    }

    async function refreshSelectedEvent() {
      if (!state.selectedEventId) {
        state.selectedEvent = null;
        state.selectedEventItems = [];
        state.selectedEventStatusCounts = {};
        renderSelectedEvent();
        return;
      }
      const data = await api('/events/' + state.selectedEventId);
      state.selectedEvent = data.event || null;
      state.selectedEventItems = data.items || [];
      state.selectedEventStatusCounts = data.statusCounts || {};
      renderSelectedEvent();
    }

    async function refreshAll() {
      await Promise.all([refreshCategories(), refreshItems(), refreshEvents(), refreshBoxes()]);
      await refreshSelectedEvent();
    }

    async function initSession() {
      try {
        const data = await api('/auth/me');
        state.user = data.user;
        setAppVisible(true);
        await refreshAll();
      } catch {
        state.user = null;
        setAppVisible(false);
      }
    }

    function bindActions() {
      byId('loginBtn').addEventListener('click', async function() {
        try {
          const payload = {
            email: byId('loginEmail').value,
            password: byId('loginPassword').value
          };
          const data = await api('/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
          });
          state.user = data.user;
          setAppVisible(true);
          showStatus('Logged in.', 'ok');
          await refreshAll();
        } catch (error) {
          showStatus(String(error.message || error), 'err');
        }
      });

      byId('logoutBtn').addEventListener('click', async function() {
        try {
          await api('/auth/logout', { method: 'POST' });
        } catch {}
        state.user = null;
        setAppVisible(false);
        showStatus('Logged out.', 'ok');
      });

      byId('refreshAll').addEventListener('click', async function() {
        try {
          await refreshAll();
          showStatus('Data refreshed.', 'ok');
        } catch (error) {
          showStatus(String(error.message || error), 'err');
        }
      });

      byId('createCategoryBtn').addEventListener('click', async function() {
        try {
          await api('/inventory/categories', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name: byId('catName').value,
              description: byId('catDesc').value || undefined
            })
          });
          byId('catName').value = '';
          byId('catDesc').value = '';
          await refreshCategories();
          showStatus('Category created.', 'ok');
        } catch (error) {
          showStatus(String(error.message || error), 'err');
        }
      });

      byId('createItemBtn').addEventListener('click', async function() {
        try {
          await api('/inventory/items', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name: byId('itemName').value,
              code: byId('itemCode').value || undefined,
              categoryId: byId('itemCategory').value,
              quantity: Number(byId('itemQty').value || '0'),
              notes: byId('itemNotes').value || undefined
            })
          });
          byId('itemName').value = '';
          byId('itemCode').value = '';
          byId('itemQty').value = '0';
          byId('itemNotes').value = '';
          await refreshItems();
          showStatus('Item created.', 'ok');
        } catch (error) {
          showStatus(String(error.message || error), 'err');
        }
      });

      byId('createEventBtn').addEventListener('click', async function() {
        try {
          const dateValue = byId('eventDate').value;
          await api('/events', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name: byId('eventName').value,
              eventDate: dateValue ? new Date(dateValue).toISOString() : '',
              location: byId('eventLocation').value,
              notes: byId('eventNotes').value || undefined
            })
          });
          byId('eventName').value = '';
          byId('eventDate').value = '';
          byId('eventLocation').value = '';
          byId('eventNotes').value = '';
          await refreshEvents();
          showStatus('Event created.', 'ok');
        } catch (error) {
          showStatus(String(error.message || error), 'err');
        }
      });

      byId('addEventItemBtn').addEventListener('click', async function() {
        if (!state.selectedEventId) {
          showStatus('Select event first.', 'err');
          return;
        }
        try {
          await api('/events/' + state.selectedEventId + '/items', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              itemId: byId('eventItemSelect').value,
              plannedQuantity: Number(byId('eventItemQty').value || '1')
            })
          });
          byId('eventItemQty').value = '1';
          await refreshSelectedEvent();
          showStatus('Item added to event.', 'ok');
        } catch (error) {
          showStatus(String(error.message || error), 'err');
        }
      });

      byId('downloadPacking').addEventListener('click', function() {
        if (!state.selectedEventId) {
          showStatus('Select event first.', 'err');
          return;
        }
        window.open('/events/' + state.selectedEventId + '/exports/packing-list', '_blank');
      });

      byId('downloadReport').addEventListener('click', function() {
        if (!state.selectedEventId) {
          showStatus('Select event first.', 'err');
          return;
        }
        window.open('/events/' + state.selectedEventId + '/exports/post-event-report', '_blank');
      });

      byId('createBoxBtn').addEventListener('click', async function() {
        try {
          await api('/boxes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              boxCode: byId('boxCode').value,
              name: byId('boxName').value,
              notes: byId('boxNotes').value || undefined
            })
          });
          byId('boxCode').value = '';
          byId('boxName').value = '';
          byId('boxNotes').value = '';
          await refreshBoxes();
          showStatus('Box created.', 'ok');
        } catch (error) {
          showStatus(String(error.message || error), 'err');
        }
      });
    }

    document.addEventListener('DOMContentLoaded', async function() {
      wireTabs();
      bindActions();
      await initSession();
    });
  </script>
</body>
</html>`;
}
