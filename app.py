import streamlit as st
import mysql.connector
from mysql.connector import Error
import pandas as pd
from datetime import datetime
import hashlib
import os

# ==================== Page Config ====================
st.set_page_config(
    page_title="ClipVault",
    page_icon="📋",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ==================== Custom CSS ====================
st.markdown("""
<style>
    .main {
        padding: 2rem;
    }
    .stButton button {
        width: 100%;
        border-radius: 8px;
        border: none;
        font-weight: 600;
    }
    .success-message {
        color: #10b981;
    }
    .error-message {
        color: #ef4444;
    }
    h1 {
        color: #2563eb;
        margin-bottom: 0.5rem;
    }
    .item-container {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1rem;
        background-color: #f9fafb;
    }
</style>
""", unsafe_allow_html=True)

# ==================== Database Connection ====================
@st.cache_resource
def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host=st.secrets["tidb"]["host"],
            user=st.secrets["tidb"]["user"],
            password=st.secrets["tidb"]["password"],
            database=st.secrets["tidb"]["database"],
            port=st.secrets["tidb"]["port"],
            autocommit=True
        )
        return connection
    except Error as e:
        st.error(f"❌ Database connection error: {e}")
        return None

# ==================== Database Functions ====================
def init_database():
    """Initialize database tables"""
    conn = get_db_connection()
    if conn is None:
        return False
    
    try:
        cursor = conn.cursor()
        
        # Create items table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS items (
                id VARCHAR(100) PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                preview TEXT,
                content LONGTEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                size VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_type (type),
                INDEX idx_created_at (created_at),
                INDEX idx_timestamp (timestamp)
            )
        """)
        
        cursor.close()
        return True
    except Error as e:
        st.error(f"❌ Database initialization error: {e}")
        return False

def generate_id():
    """Generate unique ID"""
    return hashlib.md5(f"{datetime.now().isoformat()}".encode()).hexdigest()[:16]

def save_item(item_type, title, preview, content, size=None):
    """Save item to database"""
    conn = get_db_connection()
    if conn is None:
        return False
    
    try:
        cursor = conn.cursor()
        item_id = generate_id()
        
        cursor.execute("""
            INSERT INTO items (id, type, title, preview, content, size, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (item_id, item_type, title, preview, content, size, datetime.now()))
        
        cursor.close()
        return True
    except Error as e:
        st.error(f"❌ Error saving item: {e}")
        return False

def get_all_items():
    """Get all items from database"""
    conn = get_db_connection()
    if conn is None:
        return []
    
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, type, title, preview, content, timestamp, size
            FROM items
            ORDER BY timestamp DESC
        """)
        items = cursor.fetchall()
        cursor.close()
        return items
    except Error as e:
        st.error(f"❌ Error fetching items: {e}")
        return []

def get_items_by_type(item_type):
    """Get items filtered by type"""
    conn = get_db_connection()
    if conn is None:
        return []
    
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, type, title, preview, content, timestamp, size
            FROM items
            WHERE type = %s
            ORDER BY timestamp DESC
        """, (item_type,))
        items = cursor.fetchall()
        cursor.close()
        return items
    except Error as e:
        st.error(f"❌ Error fetching items: {e}")
        return []

def search_items(query):
    """Search items"""
    conn = get_db_connection()
    if conn is None:
        return []
    
    try:
        cursor = conn.cursor(dictionary=True)
        search_query = f"%{query}%"
        cursor.execute("""
            SELECT id, type, title, preview, content, timestamp, size
            FROM items
            WHERE title LIKE %s OR preview LIKE %s OR content LIKE %s
            ORDER BY timestamp DESC
            LIMIT 50
        """, (search_query, search_query, search_query))
        items = cursor.fetchall()
        cursor.close()
        return items
    except Error as e:
        st.error(f"❌ Error searching items: {e}")
        return []

def delete_item(item_id):
    """Delete item from database"""
    conn = get_db_connection()
    if conn is None:
        return False
    
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM items WHERE id = %s", (item_id,))
        cursor.close()
        return True
    except Error as e:
        st.error(f"❌ Error deleting item: {e}")
        return False

def get_stats():
    """Get statistics"""
    conn = get_db_connection()
    if conn is None:
        return None
    
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN type = 'text' THEN 1 ELSE 0 END) as text_count,
                SUM(CASE WHEN type = 'link' THEN 1 ELSE 0 END) as link_count,
                SUM(CASE WHEN type = 'file' THEN 1 ELSE 0 END) as file_count,
                SUM(CASE WHEN type = 'image' THEN 1 ELSE 0 END) as image_count
            FROM items
        """)
        stats = cursor.fetchone()
        cursor.close()
        return stats
    except Error as e:
        st.error(f"❌ Error fetching stats: {e}")
        return None

def detect_type(content):
    """Detect content type"""
    if content.startswith('http://') or content.startswith('https://'):
        return 'link'
    return 'text'

def format_timestamp(ts):
    """Format timestamp"""
    if isinstance(ts, str):
        return ts
    return ts.strftime("%Y-%m-%d %H:%M:%S") if ts else ""

# ==================== Main App ====================
def main():
    # Initialize database
    init_database()
    
    # Header
    st.markdown("# 📋 ClipVault")
    st.markdown("*Simpan link, teks, gambar & file dalam satu tempat*")
    st.divider()
    
    # Tabs
    tab1, tab2, tab3 = st.tabs(["📝 Input", "📚 Library", "📊 Stats"])
    
    # ==================== Tab 1: Input ====================
    with tab1:
        col1, col2 = st.columns([3, 1])
        
        with col1:
            input_text = st.text_area(
                "Paste link, teks, atau deskripsi file:",
                height=120,
                placeholder="Contoh: https://example.com atau teks apapun..."
            )
        
        with col2:
            uploaded_file = st.file_uploader("Atau upload file:", accept_multiple_files=True)
        
        st.divider()
        
        col1, col2, col3 = st.columns(3)
        
        # Save Text
        with col1:
            if st.button("💾 Simpan Teks", use_container_width=True):
                if input_text.strip():
                    item_type = detect_type(input_text)
                    title = input_text[:100].split('\n')[0]
                    preview = input_text[:200]
                    
                    if save_item(item_type, title, preview, input_text):
                        st.success("✅ Teks berhasil disimpan!")
                        st.rerun()
                    else:
                        st.error("❌ Gagal menyimpan")
                else:
                    st.warning("⚠️ Masukkan teks terlebih dahulu")
        
        # Upload File
        with col2:
            if st.button("📎 Simpan File", use_container_width=True):
                if uploaded_file:
                    for file in uploaded_file:
                        file_content = file.read()
                        file_size = len(file_content) / 1024  # KB
                        
                        # Detect type
                        if file.type.startswith('image/'):
                            file_type = 'image'
                        else:
                            file_type = 'file'
                        
                        # Convert to base64 for storage
                        import base64
                        file_base64 = base64.b64encode(file_content).decode()
                        
                        if save_item(
                            file_type,
                            file.name,
                            file.name,
                            file_base64,
                            f"{file_size:.2f} KB"
                        ):
                            st.success(f"✅ {file.name} berhasil disimpan!")
                        else:
                            st.error(f"❌ Gagal menyimpan {file.name}")
                    st.rerun()
                else:
                    st.warning("⚠️ Pilih file terlebih dahulu")
        
        # Clear
        with col3:
            if st.button("🗑️ Hapus Input", use_container_width=True):
                st.session_state.clear()
                st.rerun()
    
    # ==================== Tab 2: Library ====================
    with tab2:
        col1, col2, col3 = st.columns([2, 1, 1])
        
        with col1:
            search_query = st.text_input("🔍 Cari...", placeholder="Ketik untuk mencari")
        
        with col2:
            filter_type = st.selectbox(
                "Filter:",
                ["Semua", "text", "link", "file", "image"]
            )
        
        with col3:
            if st.button("🔄 Refresh", use_container_width=True):
                st.rerun()
        
        st.divider()
        
        # Get items
        if search_query:
            items = search_items(search_query)
        elif filter_type != "Semua":
            items = get_items_by_type(filter_type)
        else:
            items = get_all_items()
        
        if items:
            for item in items:
                with st.container():
                    st.markdown(f"<div class='item-container'>", unsafe_allow_html=True)
                    
                    col1, col2, col3 = st.columns([1, 3, 1])
                    
                    with col1:
                        # Icon
                        icon_map = {
                            'text': '📝',
                            'link': '🔗',
                            'file': '📁',
                            'image': '🖼️'
                        }
                        st.markdown(f"### {icon_map.get(item['type'], '📎')}")
                    
                    with col2:
                        st.markdown(f"**{item['title']}**")
                        st.caption(f"_{item['preview'][:100]}_")
                        st.caption(f"🕐 {format_timestamp(item['timestamp'])} {f'• {item[\"size\"]}' if item['size'] else ''}")
                    
                    with col3:
                        col_a, col_b = st.columns(2)
                        
                        with col_a:
                            if st.button("📋", key=f"copy_{item['id']}", help="Copy"):
                                st.write(f"```\n{item['content'][:500]}\n```")
                        
                        with col_b:
                            if st.button("🗑️", key=f"delete_{item['id']}", help="Delete"):
                                if delete_item(item['id']):
                                    st.success("✅ Deleted!")
                                    st.rerun()
                    
                    st.markdown("</div>", unsafe_allow_html=True)
        else:
            st.info("📭 Tidak ada item. Mulai dengan menambahkan teks atau file di tab Input.")
    
    # ==================== Tab 3: Stats ====================
    with tab3:
        stats = get_stats()
        
        if stats:
            col1, col2, col3, col4, col5 = st.columns(5)
            
            with col1:
                st.metric("📊 Total", stats['total'] or 0)
            
            with col2:
                st.metric("📝 Teks", stats['text_count'] or 0)
            
            with col3:
                st.metric("🔗 Link", stats['link_count'] or 0)
            
            with col4:
                st.metric("📁 File", stats['file_count'] or 0)
            
            with col5:
                st.metric("🖼️ Image", stats['image_count'] or 0)
            
            st.divider()
            
            # Chart
            if stats['total'] and stats['total'] > 0:
                chart_data = {
                    'Type': ['Text', 'Link', 'File', 'Image'],
                    'Count': [
                        stats['text_count'] or 0,
                        stats['link_count'] or 0,
                        stats['file_count'] or 0,
                        stats['image_count'] or 0
                    ]
                }
                df = pd.DataFrame(chart_data)
                st.bar_chart(df.set_index('Type'))
        else:
            st.info("📭 Belum ada data")

if __name__ == "__main__":
    main()
