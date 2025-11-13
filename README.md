# Reliability Web App

A comprehensive web application for Weibull reliability analysis and failure prediction. This application performs statistical analysis on failure data and provides reliability metrics, maintenance interval recommendations, and interactive visualizations.

## Features

- **Multiple Analysis Methods**: Maximum Likelihood Estimation (MLE) and Rank Regression (RR)
- **Flexible Data Input**: Supports exact failures, right-censored, left-censored, interval-censored, and grouped data
- **Comprehensive Metrics**: Calculate MTBF, B10 life, median life, mode, and reliability at specified mission times
- **Maintenance Recommendations**: Get maintenance interval recommendations for safety and non-safety devices
- **Interactive Visualizations**: Generate reliability plots with Weibull distribution curves
- **Modern UI**: Clean, responsive interface with gradient designs and intuitive navigation

## Tech Stack

### Backend
- **Flask** (Python web framework)
- **reliability** library (Weibull analysis)
- **NumPy** and **SciPy** (numerical computations)
- **Flask-CORS** (Cross-Origin Resource Sharing)
- **Gunicorn** (WSGI server)

### Frontend
- **Next.js** (React framework)
- **Bootstrap 5** (UI components)
- **Font Awesome** (icons)

## Installation

### Prerequisites
- Python 3.10+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/reliability_web_app.git
cd reliability_web_app
```

2. Create a virtual environment and install dependencies:
```bash
python -m venv venv
# On Windows
venv\Scripts\activate
# On Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

3. Run the Flask backend:
```bash
python app.py
```
The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```
The frontend will run on `http://localhost:3000`

## Deployment

### Backend Deployment (Heroku/Render)

The app includes a `Procfile` for easy deployment to Heroku or Render:

```bash
# Deploy to Heroku
heroku create your-app-name
git push heroku main

# Deploy to Render
# Connect your GitHub repository and use the Procfile
```

### Frontend Deployment (Vercel)

The frontend is optimized for Vercel deployment:

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
cd frontend
vercel
```

Or connect your GitHub repository directly to Vercel.

### Environment Variables

For production, set the following environment variable in your frontend deployment:
- `NEXT_PUBLIC_API_URL`: Your backend API URL (e.g., `https://your-backend.herokuapp.com`)

## Usage

### Step 1: Choose Analysis Method
- Select between Maximum Likelihood Estimation (MLE) or Rank Regression (RR)

### Step 2: Input Data
- Enter failure times and censored data
- Preprocess date formats if needed
- Choose rank regression method (if applicable)

### Step 3: Set Parameters
- For Mission Time: Specify desired reliability percentage
- For MTBF: Calculate mean time between failures

### Step 4: View Results
- Analyze beta (shape) and alpha (scale) parameters
- Review failure pattern interpretation (age-related, random, infant mortality)
- Check maintenance interval recommendations
- View reliability metrics (B10, B50, Mode)
- Generate reliability vs. time plots

## API Endpoints

- `POST /api/reliability` - Perform reliability analysis
- `POST /api/plot` - Generate reliability plot
- `GET /api/health` - Health check endpoint

## Project Structure

```
reliability_web_app/
├── app.py                 # Flask backend application
├── requirements.txt       # Python dependencies
├── Procfile              # Heroku/Render deployment config
├── Dockerfile            # Docker container config
├── .gitignore           # Git ignore rules
├── frontend/
│   ├── pages/           # Next.js pages
│   │   ├── index.js     # Step 1: Method selection
│   │   ├── preprocess.js # Date preprocessing
│   │   ├── step2.js     # Step 2: Data input
│   │   ├── step3.js     # Step 3: Parameter selection
│   │   ├── step3b.js    # Alternative parameter selection
│   │   └── step4.js     # Step 4: Results display
│   ├── lib/
│   │   └── api.js       # API helper functions
│   ├── styles/
│   │   └── globals.css  # Global styles
│   ├── package.json     # Node.js dependencies
│   └── next.config.js   # Next.js configuration
└── scripts/
    └── check_numpy.py   # NumPy compatibility check
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or suggestions, please open an issue on GitHub.
