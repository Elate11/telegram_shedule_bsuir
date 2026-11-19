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

  // Theme & customization states exactly like Kotlin App
  const [isDarkTheme, setIsDarkTheme] = useState(true)
  // Apple signature interactive blue accent: Sky Link Blue (#2997ff) on dark, Action Blue (#0066cc) on light
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('app_accent_color') || '#2997FF')
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

  // Effective colors from Kotlin AppleDesign
  // actualBg: AppleTokens.Tile1 (#272729) on dark, Parchment (#F5F5F7) on light
  const bgColor = styleType === 'Techno' ? '#000000' : isDarkTheme ? '#101116' : '#F5F5F7'
  const textColor = styleType === 'Techno' ? '#00FF41' : isDarkTheme ? '#FFFFFF' : '#1D1D1F'

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between overflow-hidden"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* Techno Scanline overlay if Techno style is active */}
      {styleType === 'Techno' && (
        <div
          className="pointer-events-none absolute inset-0 z-30 opacity-5"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #00FF41, #00FF41 1px, transparent 1px, transparent 2px)',
            backgroundSize: '100% 2px'
          }}
        />
      )}

      {/* Main Viewport Container (Centered for tablets/desktops up to max-w-2xl) */}
      <div className="flex-1 w-full max-w-2xl mx-auto overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
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
                styleType={styleType}
              />
            )}
            {currentTab === 1 && (
              <MarksScreen
                accentColor={accentColor}
                isDarkTheme={isDarkTheme}
              />
            )}
            {currentTab === 2 && (
              <NotesScreen
                accentColor={accentColor}
                isDarkTheme={isDarkTheme}
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

      {/* Bottom Floating Navigation (Sliding bubble in Minimal / ASCII in Techno) */}
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
