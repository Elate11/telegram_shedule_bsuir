import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScheduleScreen } from './screens/ScheduleScreen'
import { MarksScreen } from './screens/MarksScreen'
import { NotesScreen } from './screens/NotesScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { BottomNavigation } from './components/BottomNavigation'
import { tg } from './services/telegram'
import type { StyleType, NavigationMode, TransitionType } from './types'

export function App() {
  const [currentTab, setCurrentTab] = useState(0)
  const [currentGroup, setCurrentGroup] = useState(() => localStorage.getItem('app_selected_group') || '114001')
  const [subgroup, setSubgroup] = useState<number>(() => {
    const s = localStorage.getItem('app_selected_subgroup')
    return s ? parseInt(s, 10) : 0
  })

  // Theme & customization states
  const [isDarkTheme, setIsDarkTheme] = useState(true)
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('app_accent_color') || '#6C63FF')
  const [styleType, setStyleType] = useState<StyleType>(() => (localStorage.getItem('app_style_type') as StyleType) || 'Minimal')
  const [navMode, setNavMode] = useState<NavigationMode>(() => (localStorage.getItem('app_nav_mode') as NavigationMode) || 'Buttons')
  const [transitionType, setTransitionType] = useState<TransitionType>(() => (localStorage.getItem('app_transition_type') as TransitionType) || 'Slide')

  // Init Telegram WebApp
  useEffect(() => {
    if (tg) {
      tg.ready()
      tg.expand()
      try {
        tg.headerColor = isDarkTheme ? '#101116' : '#FFFFFF'
        tg.backgroundColor = isDarkTheme ? '#101116' : '#FFFFFF'
      } catch {}
    }
  }, [isDarkTheme])

  // Persist settings
  useEffect(() => {
    localStorage.setItem('app_selected_group', currentGroup)
  }, [currentGroup])

  useEffect(() => {
    localStorage.setItem('app_selected_subgroup', subgroup.toString())
  }, [subgroup])

  useEffect(() => {
    localStorage.setItem('app_accent_color', accentColor)
  }, [accentColor])

  useEffect(() => {
    localStorage.setItem('app_style_type', styleType)
  }, [styleType])

  useEffect(() => {
    localStorage.setItem('app_nav_mode', navMode)
  }, [navMode])

  useEffect(() => {
    localStorage.setItem('app_transition_type', transitionType)
  }, [transitionType])

  // Transition variants
  const getVariants = () => {
    if (transitionType === 'Fade') {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 }
      }
    }
    if (transitionType === 'Scale') {
      return {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.96 }
      }
    }
    // Default Slide
    return {
      initial: { opacity: 0, x: 20 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -20 }
    }
  }

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between overflow-hidden ${
        isDarkTheme ? 'bg-[#101116] text-white' : 'bg-[#FAFAFA] text-zinc-900'
      } ${styleType === 'Techno' ? 'font-mono' : ''}`}
    >
      {/* Dynamic Background Mesh Glow (Apple design) */}
      {styleType !== 'Techno' && (
        <div
          className="pointer-events-none absolute top-[-10%] left-[-10%] w-[120%] h-[50%] blur-[120px] opacity-20 -z-10 transition-colors duration-500"
          style={{
            background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`
          }}
        />
      )}

      {/* Techno Scanline effect if selected */}
      {styleType === 'Techno' && (
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-5"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #00FF41, #00FF41 1px, transparent 1px, transparent 2px)',
            backgroundSize: '100% 2px'
          }}
        />
      )}

      {/* Main Screen Swiper / Viewport */}
      <div className="flex-1 w-full max-w-4xl mx-auto overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            variants={getVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="flex-1 w-full h-full overflow-hidden"
          >
            {currentTab === 0 && (
              <ScheduleScreen
                currentGroup={currentGroup}
                onGroupChange={setCurrentGroup}
                subgroup={subgroup}
                onSubgroupChange={setSubgroup}
                accentColor={accentColor}
                isDarkTheme={isDarkTheme}
              />
            )}
            {currentTab === 1 && (
              <MarksScreen
                accentColor={accentColor}
              />
            )}
            {currentTab === 2 && (
              <NotesScreen
                accentColor={accentColor}
              />
            )}
            {currentTab === 3 && (
              <ProfileScreen
                isDarkTheme={isDarkTheme}
                onToggleTheme={() => setIsDarkTheme(!isDarkTheme)}
                accentColor={accentColor}
                onAccentChange={setAccentColor}
                styleType={styleType}
                onStyleChange={setStyleType}
                navMode={navMode}
                onNavModeChange={setNavMode}
                transitionType={transitionType}
                onTransitionChange={setTransitionType}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Floating Navigation */}
      <BottomNavigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        navMode={navMode}
        styleType={styleType}
        accentColor={accentColor}
      />
    </div>
  )
}

export default App
