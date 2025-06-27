# Remote Workspace Guide - IAE Chatbot Mistral

## Quick Start Commands

Once your devcontainer is running, use these commands to get started:

### Development
```bash
# Start the development server
npm start

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
```

### Environment Setup
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Add your Mistral AI API key to `.env`:
   ```
   REACT_APP_MISTRAL_API_KEY=your_api_key_here
   ```

### Useful Development Tips

- **Hot Reload**: The dev server runs on port 3000 with hot reload enabled
- **ESLint**: Code is automatically linted on save
- **Tailwind CSS**: IntelliSense is configured for Tailwind classes
- **Debug Panel**: The app includes a debug panel to test API connectivity

### Troubleshooting

- If dependencies are missing, run `npm install`
- If the server doesn't start, check that port 3000 is available
- For API issues, verify your Mistral API key in the debug panel

### Project Structure
```
src/
├── App.js          # Main application component
├── App.css         # Application styles
├── index.js        # React entry point
└── index.css       # Global styles with Tailwind
```

### Multi-Agent Features
This chatbot implements three specialized agents:
1. **Document Library Agent** - Manages document storage and retrieval
2. **Websearch Agent** - Performs real-time web searches
3. **Document Q&A Agent** - Answers questions based on uploaded documents