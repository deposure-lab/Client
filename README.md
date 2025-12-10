# Deposure Client

> **All files in this repository are the exclusive property of *Deposure Inc.* They are published here solely for transparency, so users can see exactly what runs on their system.**
>
> **Deposure Inc. respects user privacy and believes in making all client-side code visible, inspectable, and auditable.**

Deposure Client is an open‑source command‑line companion for the **Deposure Platform**, allowing you to register, configure, enable, monitor, and manage applications that connect to Deposure’s reverse‑tunneling and inspection infrastructure.

This client is intended to run on **Linux** or **Windows**, and is designed to operate with **root/sudo permissions** (on Linux) due to access to `/etc/deposure`.

---

## 📦 Installation

Download Binary File that support your OS and Architecture for e.g: deposure-client-linux-x64

## 🧰 Setup

Run the client:

```bash
./[binary_name] <command> 
```

Available Commands:

### `create`

Adds a new application entry to the configuration.

```bash
sudo ./[binary_name] create
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
sudo ./[binary_name]  add-token YOUR_TOKEN_HERE
```

Token is used to authenticate your device with Deposure.
Get it from:
**Deposure Dashboard → REST API → API Tokens**

---

### `start <app>`

Starts application tunneling and inspection handlers.

```bash
sudo ./[binary_name] start myApp
```

### `stop <app>`

Stops the application handler.

```bash
sudo ./[binary_name] stop myApp
```

### `enable <app>` / `disable <app>`

Enables or disables the application in configuration.

```bash
sudo ./[binary_name]  enable myApp
sudo ./[binary_name]  disable myApp
```

### `status`

Prints the current status of all registered applications.

```bash
sudo ./[binary_name]  status
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


