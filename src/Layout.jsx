.app-shell-v2 {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.shell-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.sidebar-rail {
  width: 84px;
  background: var(--nav-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  flex-shrink: 0;
}

.rail-brand {
  color: var(--nav-text);
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 13px;
  text-align: center;
  margin-bottom: 24px;
  padding: 0 8px;
  line-height: 1.3;
}

.rail-item {
  background: none;
  border: none;
  color: var(--nav-mist);
  font-size: 12px;
  padding: 12px 4px;
  width: 100%;
  cursor: pointer;
  text-decoration: none;
  display: block;
  text-align: center;
  border-left: 3px solid transparent;
  font-family: inherit;
}

.rail-item:hover {
  color: var(--nav-text);
  background: rgba(255, 255, 255, 0.05);
}

.rail-item.active {
  color: var(--nav-text);
  border-left-color: var(--route-blue);
  background: rgba(255, 255, 255, 0.08);
}

.rail-spacer {
  flex: 1;
}

.sidebar-panel {
  width: 200px;
  background: var(--panel);
  border-right: 1px solid var(--border);
  padding: 20px 12px;
  flex-shrink: 0;
}

.sidebar-panel h3 {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--mist);
  letter-spacing: 0.05em;
  margin: 0 0 12px 8px;
}

.sidebar-panel-link {
  display: block;
  padding: 10px 8px;
  color: var(--paper);
  text-decoration: none;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 2px;
}

.sidebar-panel-link:hover {
  background: var(--ink);
}

.sidebar-panel-link.active {
  background: var(--route-blue);
  color: white;
}

.main-content-area {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
  min-width: 0;
}
