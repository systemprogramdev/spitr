export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          handle: string
          name: string
          bio: string | null
          avatar_url: string | null
          banner_url: string | null
          location: string | null
          website: string | null
          hp: number
          is_destroyed: boolean
          last_chest_claimed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          handle: string
          name: string
          bio?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          location?: string | null
          website?: string | null
          hp?: number
          is_destroyed?: boolean
          last_chest_claimed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          handle?: string
          name?: string
          bio?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          location?: string | null
          website?: string | null
          hp?: number
          is_destroyed?: boolean
          last_chest_claimed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      spits: {
        Row: {
          id: string
          user_id: string
          content: string
          image_url: string | null
          reply_to_id: string | null
          effect: string | null
          hp: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          image_url?: string | null
          reply_to_id?: string | null
          effect?: string | null
          hp?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          image_url?: string | null
          reply_to_id?: string | null
          effect?: string | null
          hp?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spits_reply_to_id_fkey"
            columns: ["reply_to_id"]
            referencedRelation: "spits"
            referencedColumns: ["id"]
          }
        ]
      }
      likes: {
        Row: {
          user_id: string
          spit_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          spit_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          spit_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_spit_id_fkey"
            columns: ["spit_id"]
            referencedRelation: "spits"
            referencedColumns: ["id"]
          }
        ]
      }
      respits: {
        Row: {
          user_id: string
          spit_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          spit_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          spit_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "respits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respits_spit_id_fkey"
            columns: ["spit_id"]
            referencedRelation: "spits"
            referencedColumns: ["id"]
          }
        ]
      }
      follows: {
        Row: {
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          follower_id?: string
          following_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          user_id: string
          last_read_at: string | null
          deleted_at: string | null
        }
        Insert: {
          conversation_id: string
          user_id: string
          last_read_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          conversation_id?: string
          user_id?: string
          last_read_at?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          image_url?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'follow' | 'like' | 'respit' | 'reply' | 'mention' | 'message' | 'attack' | 'like_reward' | 'transfer'
          actor_id: string
          spit_id: string | null
          reference_id: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'follow' | 'like' | 'respit' | 'reply' | 'mention' | 'message' | 'attack' | 'like_reward' | 'transfer'
          actor_id: string
          spit_id?: string | null
          reference_id?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'follow' | 'like' | 'respit' | 'reply' | 'mention' | 'message' | 'attack' | 'like_reward' | 'transfer'
          actor_id?: string
          spit_id?: string | null
          reference_id?: string | null
          read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_spit_id_fkey"
            columns: ["spit_id"]
            referencedRelation: "spits"
            referencedColumns: ["id"]
          }
        ]
      }
      user_credits: {
        Row: {
          user_id: string
          balance: number
          free_credits_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          balance?: number
          free_credits_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          balance?: number
          free_credits_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          type: 'free_monthly' | 'purchase' | 'post' | 'reply' | 'respit' | 'like' | 'pin_purchase' | 'convert' | 'like_reward' | 'transfer_sent' | 'transfer_received' | 'chest_purchase'
          amount: number
          balance_after: number
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'free_monthly' | 'purchase' | 'post' | 'reply' | 'respit' | 'like' | 'pin_purchase' | 'convert' | 'like_reward' | 'transfer_sent' | 'transfer_received' | 'chest_purchase'
          amount: number
          balance_after: number
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'free_monthly' | 'purchase' | 'post' | 'reply' | 'respit' | 'like' | 'pin_purchase' | 'convert' | 'like_reward' | 'transfer_sent' | 'transfer_received' | 'chest_purchase'
          amount?: number
          balance_after?: number
          reference_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      pinned_spits: {
        Row: {
          id: string
          spit_id: string
          user_id: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          spit_id: string
          user_id: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          spit_id?: string
          user_id?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_spits_spit_id_fkey"
            columns: ["spit_id"]
            referencedRelation: "spits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_spits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      pin_views: {
        Row: {
          pin_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          pin_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          pin_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_views_pin_id_fkey"
            columns: ["pin_id"]
            referencedRelation: "pinned_spits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_views_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_gold: {
        Row: {
          user_id: string
          balance: number
          updated_at: string
        }
        Insert: {
          user_id: string
          balance?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_gold_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      gold_transactions: {
        Row: {
          id: string
          user_id: string
          type: 'purchase' | 'convert' | 'item_purchase'
          amount: number
          balance_after: number
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'purchase' | 'convert' | 'item_purchase'
          amount: number
          balance_after: number
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'purchase' | 'convert' | 'item_purchase'
          amount?: number
          balance_after?: number
          reference_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gold_transactions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_inventory: {
        Row: {
          id: string
          user_id: string
          item_type: 'knife' | 'gun' | 'soldier' | 'drone' | 'small_potion' | 'medium_potion' | 'large_potion'
          quantity: number
        }
        Insert: {
          id?: string
          user_id: string
          item_type: 'knife' | 'gun' | 'soldier' | 'drone' | 'small_potion' | 'medium_potion' | 'large_potion'
          quantity?: number
        }
        Update: {
          id?: string
          user_id?: string
          item_type?: 'knife' | 'gun' | 'soldier' | 'drone' | 'small_potion' | 'medium_potion' | 'large_potion'
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      attack_log: {
        Row: {
          id: string
          attacker_id: string
          target_user_id: string | null
          target_spit_id: string | null
          item_type: 'knife' | 'gun' | 'soldier' | 'drone' | 'small_potion' | 'medium_potion' | 'large_potion'
          damage: number
          created_at: string
        }
        Insert: {
          id?: string
          attacker_id: string
          target_user_id?: string | null
          target_spit_id?: string | null
          item_type: 'knife' | 'gun' | 'soldier' | 'drone' | 'small_potion' | 'medium_potion' | 'large_potion'
          damage: number
          created_at?: string
        }
        Update: {
          id?: string
          attacker_id?: string
          target_user_id?: string | null
          target_spit_id?: string | null
          item_type?: 'knife' | 'gun' | 'soldier' | 'drone' | 'small_potion' | 'medium_potion' | 'large_potion'
          damage?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attack_log_attacker_id_fkey"
            columns: ["attacker_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attack_log_target_user_id_fkey"
            columns: ["target_user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attack_log_target_spit_id_fkey"
            columns: ["target_spit_id"]
            referencedRelation: "spits"
            referencedColumns: ["id"]
          }
        ]
      }
      user_chests: {
        Row: {
          id: string
          user_id: string
          claimed_at: string
          opened: boolean
          loot: Json | null
          opened_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          claimed_at?: string
          opened?: boolean
          loot?: Json | null
          opened_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          claimed_at?: string
          opened?: boolean
          loot?: Json | null
          opened_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_chests_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      like_rewards: {
        Row: {
          user_id: string
          spit_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          spit_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          spit_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "like_rewards_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "like_rewards_spit_id_fkey"
            columns: ["spit_id"]
            referencedRelation: "spits"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      notification_type: 'follow' | 'like' | 'respit' | 'reply' | 'mention' | 'message' | 'attack' | 'like_reward' | 'transfer'
      transaction_type: 'free_monthly' | 'purchase' | 'post' | 'reply' | 'respit' | 'like' | 'pin_purchase' | 'convert' | 'like_reward' | 'transfer_sent' | 'transfer_received' | 'chest_purchase'
      gold_transaction_type: 'purchase' | 'convert' | 'item_purchase'
      item_type: 'knife' | 'gun' | 'soldier' | 'drone' | 'small_potion' | 'medium_potion' | 'large_potion'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row']
export type Spit = Database['public']['Tables']['spits']['Row']
export type Like = Database['public']['Tables']['likes']['Row']
export type Respit = Database['public']['Tables']['respits']['Row']
export type Follow = Database['public']['Tables']['follows']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type UserCredits = Database['public']['Tables']['user_credits']['Row']
export type CreditTransaction = Database['public']['Tables']['credit_transactions']['Row']
export type PinnedSpit = Database['public']['Tables']['pinned_spits']['Row']
export type UserGold = Database['public']['Tables']['user_gold']['Row']
export type GoldTransaction = Database['public']['Tables']['gold_transactions']['Row']
export type UserInventory = Database['public']['Tables']['user_inventory']['Row']
export type AttackLog = Database['public']['Tables']['attack_log']['Row']
export type UserChest = Database['public']['Tables']['user_chests']['Row']
export type ItemType = Database['public']['Enums']['item_type']
export type LikeReward = Database['public']['Tables']['like_rewards']['Row']

// Extended types for UI
export interface SpitWithAuthor extends Spit {
  author: User
  like_count: number
  respit_count: number
  reply_count: number
  is_liked: boolean
  is_respit: boolean
  is_pinned?: boolean
}

export interface ConversationWithParticipants extends Conversation {
  participants: User[]
  last_message: Message | null
  unread_count: number
}

export interface NotificationWithActor extends Notification {
  actor: User
  spit?: Spit | null
}
