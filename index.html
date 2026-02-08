<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>FoGoal AI Assistant</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ['"Lora"', 'ui-serif', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
              serif: ['"Playfair Display"', 'ui-serif', 'Georgia', 'serif'],
            },
            fontSize: {
              micro: ['calc(0.5rem * var(--font-scale))', { lineHeight: '1.4' }],
              xxs: ['calc(0.5625rem * var(--font-scale))', { lineHeight: '1.4', letterSpacing: '0.05em' }],
              mini: ['calc(0.625rem * var(--font-scale))', { lineHeight: '1.4', letterSpacing: '0.05em' }],
              tiny: ['calc(0.6875rem * var(--font-scale))', { lineHeight: '1.5', letterSpacing: '0.02em' }],
              xs: ['calc(0.75rem * var(--font-scale))', { lineHeight: '1.6', letterSpacing: '0em' }],
              sub: ['calc(0.8125rem * var(--font-scale))', { lineHeight: '1.6', letterSpacing: '0em' }],
              sm: ['calc(0.875rem * var(--font-scale))', { lineHeight: '1.6', letterSpacing: '0em' }],
              md: ['calc(0.9375rem * var(--font-scale))', { lineHeight: '1.6', letterSpacing: '0em' }],
              base: ['calc(1rem * var(--font-scale))', { lineHeight: '1.7', letterSpacing: '-0.01em' }],
              lg: ['calc(1.125rem * var(--font-scale))', { lineHeight: '1.5', letterSpacing: '-0.015em' }],
              xl: ['calc(1.25rem * var(--font-scale))', { lineHeight: '1.4', letterSpacing: '-0.02em' }],
              '2xl': ['calc(1.5rem * var(--font-scale))', { lineHeight: '1.3', letterSpacing: '-0.025em' }],
              '3xl': ['calc(2rem * var(--font-scale))', { lineHeight: '1.2', letterSpacing: '-0.03em' }],
              '4xl': ['calc(2.5rem * var(--font-scale))', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
              '5xl': ['calc(3rem * var(--font-scale))', { lineHeight: '1', letterSpacing: '-0.05em' }],
            }
          }
        }
      }
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg-main: #09090b;
        --bg-card: rgba(255, 255, 255, 0.06);
        --border-glass: rgba(255, 255, 255, 0.08);
        --text-primary: #FAFAFA;
        --text-secondary: rgba(255, 255, 255, 0.5);
        
        --theme-accent: #6366f1;
        --theme-glow: rgba(99, 102, 241, 0.1);
        
        --font-scale: 1.16;
        --base-font-size: 16px;
        --mobile-font-size: 14px;
      }

      * { box-sizing: border-box; }

      html {
        -webkit-tap-highlight-color: transparent;
        background-color: var(--bg-main);
        font-size: var(--base-font-size);
        -webkit-text-size-adjust: 100%;
      }
      
      @media (max-width: 640px) {
        html { 
          font-size: var(--mobile-font-size);
        }
      }

      body {
        font-family: 'Lora', Georgia, Cambria, "Times New Roman", Times, serif;
        background: var(--bg-main);
        color: var(--text-primary);
        overflow-x: hidden;
        scroll-behavior: smooth;
        margin: 0;
        padding: 0;
        transition: background 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        padding-bottom: env(safe-area-inset-bottom); 
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      input, button, textarea, select {
        font-family: inherit;
      }

      .font-serif { font-family: 'Playfair Display', serif; }

      ::-webkit-scrollbar { width: 0px; background: transparent; }

      @keyframes soft-fade-up {
        0% { opacity: 0; transform: translateY(10px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in-up {
        animation: soft-fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      .glass-liquid {
        background: var(--bg-card);
        backdrop-filter: blur(40px) saturate(120%);
        -webkit-backdrop-filter: blur(40px) saturate(120%);
        border: 1px solid var(--border-glass);
        transition: all 0.3s ease;
      }
      
      .glass-liquid:active { transform: scale(0.99); }
      
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@^19.2.4",
    "react-dom/": "https://esm.sh/react-dom@^19.2.4/",
    "react/": "https://esm.sh/react@^19.2.4/",
    "lucide-react": "https://esm.sh/lucide-react@^0.563.0",
    "recharts": "https://esm.sh/recharts@^3.7.0",
    "@google/genai": "https://esm.sh/@google/genai@1.17.0",
    "vite": "https://esm.sh/vite@^7.3.1",
    "@vitejs/plugin-react": "https://esm.sh/@vitejs/plugin-react@^5.1.3"
  }
}
</script>
</head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
