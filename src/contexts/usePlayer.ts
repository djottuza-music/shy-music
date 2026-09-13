import { useContext } from 'react'
import { PlayerContext } from './playerContextValue'

export function usePlayer() {
  const value = useContext(PlayerContext)
  if (!value) throw new Error('usePlayer must be used inside PlayerProvider')
  return value
}
