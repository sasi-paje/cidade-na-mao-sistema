/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Cidade na Mão (substitui a identidade azul-royal legada).
        // A troca é gradual: estes tokens centrais já mudam; classes hardcoded
        // remanescentes serão ajustadas nas próximas etapas.
        primary: {
          DEFAULT: '#1e558b', // primary-default
          dark: '#0f3255', // primary-dark
          light: '#bdcde8', // secondary-lighter (tom claro de apoio)
        },
        secondary: {
          lighter: '#bdcde8',
        },
        background: {
          light: '#f0f4f9',
          other: '#f0f4f9',
          sidebar: '#161a36',
          white: '#ffffff',
        },
        state: {
          success: {
            DEFAULT: '#27ae60',
            light: '#4ade80',
            dark: '#1e8449',
          },
          warning: {
            DEFAULT: '#e2b93b',
            light: '#f0c808',
            dark: '#b7950b',
          },
          error: {
            DEFAULT: '#eb5757',
            light: '#f08c8c',
            dark: '#c0392b',
          },
        },
        neutral: {
          black: '#000000',
          white: '#ffffff',
          gray: '#919191',
          grayLight: '#4c4c4c',
          grayLighter: '#bdbdbd',
          text: {
            primary: '#231f20',
            secondary: '#2a2a2a',
          },
        },
      },
      height: {
        'button': '45px',
        'input': '45px',
        'table-row': '46px',
        'table-header': '32px',
        'sidebar': '200px',
        'sidebar-collapsed': '88px',
        'sidebar-mini': '48px',
      },
      width: {
        'sidebar': '200px',
        'sidebar-collapsed': '88px',
        'sidebar-mini': '48px',
      },
      borderRadius: {
        'sm': '4px',
        'md': '5px',
        'lg': '8px',
      },
    },
  },
  plugins: [],
}
