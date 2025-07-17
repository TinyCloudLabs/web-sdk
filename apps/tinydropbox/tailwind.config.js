/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      width: {
        container: '1300px',
      },
      colors: {
        // 🗑️ LEGACY COLORS - KEPT FOR COMPATIBILITY
        main: 'var(--main)',
        overlay: 'var(--overlay)',
        bg: 'var(--bg)',
        bw: 'var(--bw)',
        blank: 'var(--blank)',
        text: 'var(--text)',
        mtext: 'var(--mtext)',
        border: 'var(--border)',
        ring: 'var(--ring)',
        ringOffset: 'var(--ring-offset)',
        secondaryBlack: '#212121',
        
        // 🔥 NEOBRUTALISM COLORS - DOMINATE
        'neo-yellow': 'var(--neo-yellow)',
        'neo-pink': 'var(--neo-pink)',
        'neo-lime': 'var(--neo-lime)',
        'neo-orange': 'var(--neo-orange)',
        'neo-purple': 'var(--neo-purple)',
        'neo-cyan': 'var(--neo-cyan)',
        'neo-bg-primary': 'var(--neo-bg-primary)',
        'neo-bg-secondary': 'var(--neo-bg-secondary)',
        'neo-bg-accent': 'var(--neo-bg-accent)',
        'neo-bg-dark': 'var(--neo-bg-dark)',
        'neo-bg-pink': 'var(--neo-bg-pink)',
        'neo-bg-lime': 'var(--neo-bg-lime)',
        'neo-text-primary': 'var(--neo-text-primary)',
        'neo-text-secondary': 'var(--neo-text-secondary)',
        'neo-text-inverse': 'var(--neo-text-inverse)',
        'neo-text-muted': 'var(--neo-text-muted)',
        'neo-border': 'var(--neo-border)',
      },
      borderRadius: {
        base: '8px',
        // 🎨 NEOBRUTALISM RADIUS
        'neo-sm': 'var(--neo-radius-sm)',
        'neo-md': 'var(--neo-radius-md)',
        'neo-lg': 'var(--neo-radius-lg)',
        'neo-xl': 'var(--neo-radius-xl)',
      },
      borderWidth: {
        '3': '3px',
        '4': '4px',
        '5': '5px',
        'neo': 'var(--neo-border-width)',
        'neo-thick': 'var(--neo-border-thick)',
      },
      boxShadow: {
        shadow: 'var(--shadow)',
        // 🎨 NEOBRUTALISM SHADOWS
        'neo': 'var(--neo-shadow-x) var(--neo-shadow-y) var(--neo-shadow-blur) var(--neo-shadow-color)',
        'neo-sm': '3px 3px 0px var(--neo-shadow-color)',
        'neo-lg': '8px 8px 0px var(--neo-shadow-color)',
        'neo-xl': '12px 12px 0px var(--neo-shadow-color)',
        'neo-brutal': '10px 10px 0px var(--neo-shadow-color)',
        'neo-colored': '6px 6px 0px var(--neo-pink)',
        'neo-multi': '6px 6px 0px var(--neo-pink), 12px 12px 0px var(--neo-yellow), 18px 18px 0px var(--neo-lime)',
      },
      translate: {
        boxShadowX: '3px',
        boxShadowY: '3px',
        reverseBoxShadowX: '-3px',
        reverseBoxShadowY: '-3px',
        // 🎨 NEOBRUTALISM TRANSLATE
        'neo-x': 'var(--neo-shadow-x)',
        'neo-y': 'var(--neo-shadow-y)',
        'neo-reverse-x': 'calc(-1 * var(--neo-shadow-x))',
        'neo-reverse-y': 'calc(-1 * var(--neo-shadow-y))',
      },
      fontWeight: {
        base: '500',
        heading: '700',
        // 🎨 NEOBRUTALISM WEIGHTS
        'neo-normal': '500',
        'neo-semibold': '600',
        'neo-bold': '700',
        'neo-extrabold': '800',
        'neo-black': '900',
      },
      fontSize: {
        // 🎨 NEOBRUTALISM TYPOGRAPHY SCALE
        'neo-xs': ['0.75rem', { lineHeight: '1.2', fontWeight: '700' }],
        'neo-sm': ['0.875rem', { lineHeight: '1.3', fontWeight: '600' }],
        'neo-base': ['1rem', { lineHeight: '1.5', fontWeight: '500' }],
        'neo-lg': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        'neo-xl': ['1.25rem', { lineHeight: '1.3', fontWeight: '700' }],
        'neo-2xl': ['1.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        'neo-3xl': ['1.875rem', { lineHeight: '1.1', fontWeight: '800' }],
        'neo-4xl': ['2.25rem', { lineHeight: '1.05', fontWeight: '800' }],
        'neo-5xl': ['3rem', { lineHeight: '0.9', fontWeight: '900' }],
        'neo-6xl': ['3.75rem', { lineHeight: '0.9', fontWeight: '900' }],
      },
      spacing: {
        // 🎨 NEOBRUTALISM SPACING
        'neo-xs': 'var(--neo-space-xs)',
        'neo-sm': 'var(--neo-space-sm)',
        'neo-md': 'var(--neo-space-md)',
        'neo-lg': 'var(--neo-space-lg)',
        'neo-xl': 'var(--neo-space-xl)',
        'neo-2xl': 'var(--neo-space-2xl)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        marquee2: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0%)' },
        },
        // 🎨 NEOBRUTALISM ANIMATIONS
        'neo-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'neo-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-8px)' },
          '75%': { transform: 'translateX(8px)' },
        },
        'neo-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'neo-wiggle': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-2deg)' },
          '75%': { transform: 'rotate(2deg)' },
        },
        'neo-float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'neo-glitch-1': {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        },
        'neo-glitch-2': {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(2px, -2px)' },
          '40%': { transform: 'translate(2px, 2px)' },
          '60%': { transform: 'translate(-2px, -2px)' },
          '80%': { transform: 'translate(-2px, 2px)' },
        },
        'neo-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'neo-ping': {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        marquee: 'marquee 15s linear infinite',
        marquee2: 'marquee2 15s linear infinite',
        // 🎨 NEOBRUTALISM ANIMATIONS
        'neo-bounce': 'neo-bounce 0.6s ease-in-out',
        'neo-shake': 'neo-shake 0.5s ease-in-out',
        'neo-pulse': 'neo-pulse 1s ease-in-out infinite',
        'neo-wiggle': 'neo-wiggle 0.8s ease-in-out',
        'neo-float': 'neo-float 3s ease-in-out infinite',
        'neo-glitch-1': 'neo-glitch-1 0.5s infinite',
        'neo-glitch-2': 'neo-glitch-2 0.5s infinite',
        'neo-spin': 'neo-spin 1s linear infinite',
        'neo-ping': 'neo-ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        'neo-bounce-slow': 'neo-bounce 2s ease-in-out infinite',
        'neo-shake-slow': 'neo-shake 2s ease-in-out infinite',
        'neo-pulse-slow': 'neo-pulse 3s ease-in-out infinite',
      },
      screens: {
        w900: { raw: '(max-width: 900px)' },
        w500: { raw: '(max-width: 500px)' },
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
        '350': '350ms',
        '450': '450ms',
        '550': '550ms',
        '650': '650ms',
        '750': '750ms',
        '850': '850ms',
        '950': '950ms',
        '1050': '1050ms',
      },
      transitionTimingFunction: {
        'neo-ease': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'neo-ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'neo-ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'neo-ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'neo-bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // 🎨 NEOBRUTALISM PLUGIN
    function({ addUtilities, addComponents, theme }) {
      const newUtilities = {
        '.neo-shadow': {
          boxShadow: `${theme('spacing.neo-sm')} ${theme('spacing.neo-sm')} 0px var(--neo-shadow-color)`,
        },
        '.neo-shadow-lg': {
          boxShadow: `${theme('spacing.neo-md')} ${theme('spacing.neo-md')} 0px var(--neo-shadow-color)`,
        },
        '.neo-shadow-xl': {
          boxShadow: `${theme('spacing.neo-lg')} ${theme('spacing.neo-lg')} 0px var(--neo-shadow-color)`,
        },
        '.neo-shadow-none': {
          boxShadow: 'none',
        },
        '.neo-hover': {
          transition: 'all 0.15s ease-out',
          '&:hover': {
            transform: `translate(${theme('spacing.neo-sm')}, ${theme('spacing.neo-sm')})`,
            boxShadow: 'none',
          },
        },
        '.neo-hover-reverse': {
          transition: 'all 0.15s ease-out',
          '&:hover': {
            transform: `translate(-${theme('spacing.neo-xs')}, -${theme('spacing.neo-xs')})`,
            boxShadow: `${theme('spacing.neo-sm')} ${theme('spacing.neo-sm')} 0px var(--neo-shadow-color)`,
          },
        },
        '.neo-border': {
          border: `${theme('borderWidth.neo')} solid var(--neo-border)`,
        },
        '.neo-border-thick': {
          border: `${theme('borderWidth.neo-thick')} solid var(--neo-border)`,
        },
        '.neo-text-shadow': {
          textShadow: '2px 2px 0px var(--neo-border)',
        },
        '.neo-text-shadow-lg': {
          textShadow: '4px 4px 0px var(--neo-border)',
        },
        '.neo-gradient-brutal': {
          background: 'linear-gradient(45deg, var(--neo-yellow), var(--neo-pink), var(--neo-lime))',
        },
        '.neo-gradient-sunset': {
          background: 'linear-gradient(45deg, var(--neo-orange), var(--neo-pink), var(--neo-purple))',
        },
        '.neo-tilt': {
          transform: 'rotate(1deg)',
        },
        '.neo-tilt-reverse': {
          transform: 'rotate(-1deg)',
        },
        '.neo-glow': {
          boxShadow: '0 0 20px var(--neo-yellow)',
        },
        '.neo-glow-pink': {
          boxShadow: '0 0 20px var(--neo-pink)',
        },
        '.neo-glow-lime': {
          boxShadow: '0 0 20px var(--neo-lime)',
        },
      };

      const newComponents = {
        '.neo-btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${theme('spacing.neo-sm')} ${theme('spacing.neo-md')}`,
          backgroundColor: 'var(--neo-yellow)',
          color: 'var(--neo-text-primary)',
          border: `${theme('borderWidth.neo')} solid var(--neo-border)`,
          borderRadius: theme('borderRadius.neo-md'),
          boxShadow: `${theme('spacing.neo-sm')} ${theme('spacing.neo-sm')} 0px var(--neo-shadow-color)`,
          fontWeight: theme('fontWeight.neo-semibold'),
          fontSize: theme('fontSize.neo-base[0]'),
          lineHeight: theme('fontSize.neo-base[1].lineHeight'),
          transition: 'all 0.15s ease-out',
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': {
            transform: `translate(${theme('spacing.neo-sm')}, ${theme('spacing.neo-sm')})`,
            boxShadow: 'none',
          },
          '&:focus': {
            outline: 'none',
            boxShadow: `0 0 0 4px var(--neo-pink)`,
          },
          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
          },
        },
        '.neo-btn-primary': {
          backgroundColor: 'var(--neo-yellow)',
          color: 'var(--neo-text-primary)',
        },
        '.neo-btn-secondary': {
          backgroundColor: 'var(--neo-pink)',
          color: 'var(--neo-text-inverse)',
        },
        '.neo-btn-success': {
          backgroundColor: 'var(--neo-lime)',
          color: 'var(--neo-text-primary)',
        },
        '.neo-btn-warning': {
          backgroundColor: 'var(--neo-orange)',
          color: 'var(--neo-text-inverse)',
        },
        '.neo-btn-info': {
          backgroundColor: 'var(--neo-purple)',
          color: 'var(--neo-text-inverse)',
        },
        '.neo-btn-danger': {
          backgroundColor: 'var(--neo-orange)',
          color: 'var(--neo-text-inverse)',
        },
        '.neo-card': {
          backgroundColor: 'var(--neo-bg-primary)',
          border: `${theme('borderWidth.neo')} solid var(--neo-border)`,
          borderRadius: theme('borderRadius.neo-md'),
          boxShadow: `${theme('spacing.neo-sm')} ${theme('spacing.neo-sm')} 0px var(--neo-shadow-color)`,
          padding: theme('spacing.neo-lg'),
          color: 'var(--neo-text-primary)',
        },
        '.neo-input': {
          backgroundColor: 'var(--neo-bg-primary)',
          border: `${theme('borderWidth.neo')} solid var(--neo-border)`,
          borderRadius: theme('borderRadius.neo-md'),
          padding: `${theme('spacing.neo-sm')} ${theme('spacing.neo-md')}`,
          fontSize: theme('fontSize.neo-base[0]'),
          fontWeight: theme('fontWeight.neo-normal'),
          color: 'var(--neo-text-primary)',
          boxShadow: 'inset 2px 2px 0px rgba(0,0,0,0.1)',
          transition: 'all 0.15s ease-out',
          '&:focus': {
            outline: 'none',
            boxShadow: '0 0 0 4px var(--neo-lime)',
          },
          '&::placeholder': {
            color: 'var(--neo-text-muted)',
            fontWeight: theme('fontWeight.neo-normal'),
          },
        },
        '.neo-container': {
          maxWidth: '1200px',
          margin: '0 auto',
          padding: `0 ${theme('spacing.neo-md')}`,
        },
      };

      addUtilities(newUtilities);
      addComponents(newComponents);
    },
  ],
  darkMode: 'class',
}