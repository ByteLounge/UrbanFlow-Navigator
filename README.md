# 🌐 UrbanFlow Navigator

A full-stack **React** and **Node.js** web application that provides **real-time navigation** with **weather updates**. Integrated with the **Google Maps API** for route rendering and **OpenWeather API** for current weather data. The app is hosted using **Firebase Hosting** and built with **TypeScript**, **JavaScript**, **HTML**, and **CSS**.
(App will be under constant updates to add additional new features)
---

## ✨ Features

- 🗺️ Live route rendering with Google Maps
- 🌦️ Real-time weather updates at the current location
- ⚛️ Built with React and Node.js
- 📦 Managed with npm
- 📄 Type-safe development with TypeScript
- ☁️ Firebase Hosting for fast and secure deployment

---

## 🧱 Tech Stack

| Technology     | Purpose                          |
|----------------|----------------------------------|
| React (JS/TS)  | Frontend Framework               |
| Node.js        | Backend Server                   |
| HTML/CSS       | Markup and Styling               |
| TypeScript     | Static Typing                    |
| Google Maps API| Real-time navigation             |
| OpenWeather API| Weather data                     |
| Firebase       | Hosting and Deployment           |
| npm            | Package Management               |

---

## ⚙️ Setup Instructions

### 1. 📥 Clone the Repository

```bash
git clone https://github.com/your-username/realtime-navigation-app.git
cd realtime-navigation-app
```

### 2. 📦 Install Dependencies

```bash
npm install
```

### 3. 🗝️ Configure Environment Variables

Create a `.env` file in the root of your project with the following:

```env
# .env

REACT_APP_GMAPS_API_KEY=your_google_maps_api_key
REACT_APP_WEATHER_API_KEY=your_openweather_api_key
REACT_APP_BACKEND_URL=http://localhost:5000
```

> Make sure the variable names start with `REACT_APP_` for React to expose them to the frontend.

### 4. 🛠️ Build the Application

```bash
npm run build
```

### 5. ▶️ Start the Application

- **Start the backend (Node.js)**

```bash
npm run server
```

- **Start the frontend (React)**

```bash
npm start
```

The frontend runs on `http://localhost:3000` and backend on `http://localhost:5000`.

---

## 🌐 Deploying to Firebase Hosting

### 1. 🔧 Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. 🔐 Login to Firebase

```bash
firebase login
```

### 3. 🚀 Initialize Firebase

```bash
firebase init
```

Choose:
- **Hosting**
- Set `build` as the public directory
- Configure as a **Single Page App (yes)**
- Choose not to overwrite `index.html`

### 4. 📡 Deploy the App

```bash
firebase deploy
```

---

## 📎 Notes

- Ensure your `.env` file is **not committed** to version control.
- Use `npm run build` before deploying to Firebase.
- Make sure your API keys are active and unrestricted (or restricted appropriately for security).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).



WebApp Link: https://studio--urbanflow-navigator.us-central1.hosted.app


UI/UX:

![image](https://github.com/user-attachments/assets/6da819d7-6a21-44c5-bee1-3934aa20031b)

![image](https://github.com/user-attachments/assets/f1c83955-d61f-41f5-bb8a-3ac55d178b83)

![image](https://github.com/user-attachments/assets/9c1d8c9f-dc35-4d83-8fea-815ce4601ae4)

![image](https://github.com/user-attachments/assets/a65dbbc5-1196-48d2-892d-9be4a7499843)

![image](https://github.com/user-attachments/assets/7dee373f-aff3-435c-97f8-68a3b9c3b779)

![image](https://github.com/user-attachments/assets/7aadc072-2705-4301-87e3-0c140c9988be)
