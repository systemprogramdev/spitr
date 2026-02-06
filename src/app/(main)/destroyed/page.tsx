'use client'

export default function DestroyedPage() {
  return (
    <div className="destroyed-page">
      <div className="destroyed-content">
        <div className="destroyed-skull">💀</div>
        <h1 className="destroyed-title glitch" data-text="DESTROYED">DESTROYED</h1>
        <p className="destroyed-message">
          Your account has been destroyed.
        </p>
        <p className="destroyed-sub">
          Your HP reached 0. All your spits remain visible, but you can no longer interact.
        </p>
        <div className="destroyed-static"></div>
      </div>
    </div>
  )
}
