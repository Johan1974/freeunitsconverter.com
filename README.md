# Free Units Converter

[https://freeunitsconverter.com/](https://freeunitsconverter.com/)

A fast, browser-based units converter built with **HTML**, **CSS**, and **JavaScript**, packaged with **Docker** for easy deployment. Supports multiple categories like Length, Weight, Temperature, and Volume. Saves recent conversions and favorites in the browser using `localStorage`.

---

## Features

* Convert units instantly without leaving the page
* Save recent conversions and favorites
* Responsive layout for desktop and mobile
* Add new units easily via the JS config
* No backend required for conversions (static frontend), optional backend for future API use
* Dockerized for simple deployment

---

## Project Structure

```
freeunitsconverter.com/
├── backend/        # Optional Python backend
├── certbot/        # SSL / certbot config
├── frontend/       # Static frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .gitignore
├── Dockerfile
└── README.md
```

---

## Setup

1. Clone the repository:

```
git clone <repository-url>
cd freeunitsconverter.com
```

2. Build and run the Docker container:

```
docker build -t freeunitsconverter .
docker run -p 8080:80 freeunitsconverter
```

3. Open your browser at `http://localhost:8080` to see the app.

---

## Adding New Units

* Edit `frontend/app.js` in the `CONVERTERS` array.
* Add a new category or extend an existing one with unit conversions.
* Refresh the page to see changes.

---

Todo / Roadmap

# TODO

- [ ] Make sure all pages are built and optimized for SEO and organic traffic
- [ ] Add more unit categories (e.g., Currency, Energy, Data Storage)
- [ ] Implement optional backend for user accounts / cloud storage of favorites
- [ ] Add tests for conversion accuracy and UI functionality
- [ ] Consider internationalization (i18n) for multiple languages
- [ ] Improve accessibility (ARIA, keyboard navigation, high contrast mode)
- [ ] Add analytics for user behavior insights
- [ ] Optimize Docker image for minimal size and faster startup

---

## License

MIT License
