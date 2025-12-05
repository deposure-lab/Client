# Deposure Client

> **All files in this repository are the exclusive property of *Deposure Inc.* They are published here solely for transparency, so users can see exactly what runs on their system.**
>
> **Deposure Inc. respects user privacy and believes in making all client-side code visible, inspectable, and auditable.**

Deposure Client is an open‑source command‑line companion for the **Deposure Platform**, allowing you to register, configure, enable, monitor, and manage applications that connect to Deposure’s reverse‑tunneling and inspection infrastructure.

This client is intended to run on **Linux** or **Windows**, and is designed to operate with **root/sudo permissions** (on Linux) due to access to `/etc/deposure`.

---

## 🚀 Features

* Create and manage Deposure application entries
* Manage service state (start/stop/enable/disable)
* Inspect connected applications
* Fully guided setup wizard (`prepair`)
* YAML‑based configuration stored in:

  * **Linux:** `/etc/deposure/deposure.yml`
  * **Windows:** `C:/deposure/deposure.yml`

---

## 📦 Installation

Clone the repository:

```bash
git clone https://github.com/yourname/deposure-client.git
cd deposure-client
```

Install dependencies:

```bash
npm install
```

Run the client:

```bash
node index.js <command>
```

> ⚠️ **On Linux, always run with sudo:**

```bash
sudo node index.js <command>
```

---

## 🧰 Available Commands

### `prepair`

The first command you should run.
It will:

1. Create `/etc/deposure` (or `C:/deposure`) if missing
2. Create `deposure.yml`
3. Ask for your **API Token** (found in Deposure Dashboard → *REST API / API Tokens*)
4. Guide you through configuring your **first application**

Run:

```bash
sudo node index.js prepair
```

---

### `create`

Adds a new application entry to the configuration.

```bash
sudo node index.js create
```

You will be asked:

* Application name
* Application UUID (appId)
* Port
* Protocol (http/tcp/udp)
* Whether to enable inspection

---

### `add-token <token>`

Updates the authentication token in the configuration.

```bash
sudo node index.js add-token YOUR_TOKEN_HERE
```

Token is used to authenticate your device with Deposure.
Get it from:
**Deposure Dashboard → REST API → API Tokens**

---

### `start <app>`

Starts application tunneling and inspection handlers.

```bash
sudo node index.js start myApp
```

### `stop <app>`

Stops the application handler.

```bash
sudo node index.js stop myApp
```

### `enable <app>` / `disable <app>`

Enables or disables the application in configuration.

```bash
sudo node index.js enable myApp
sudo node index.js disable myApp
```

### `status`

Prints the current status of all registered applications.

```bash
sudo node index.js status
```

---

## 📁 Configuration File Structure

The config file is stored as YAML and looks like:

```yaml
version: "3"
token: "YOUR_TOKEN_HERE"
region: "default"
console_ui: true
applications:
  myApp:
    appId: "UUID-HERE"
    addr: "3000"
    scheme: "http"
    inspect: true
    authorization: ""
meta: {}
```

---

## 🧪 Example Workflow

```bash
sudo node index.js prepair
sudo node index.js create
sudo node index.js start myApp
sudo node index.js status
```

---

## 🤝 Contributing

Contributions are welcome!
Feel free to submit PRs or report issues.

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## ❤️ Thanks

This client is built to make Deposure easier and more powerful for developers.
If you have suggestions, improvements, or requests—open an issue!
