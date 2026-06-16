import os
import time
import re
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup

app = Flask(__name__)

# Cache configuration
cache_duration = 300  # 5 minutes
cache_data = None
cache_timestamp = 0

def fetch_and_parse_feed():
    global cache_data, cache_timestamp
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    
    # Set standard User-Agent header to avoid blocking
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    
    with urllib.request.urlopen(req) as response:
        xml_content = response.read()
        
    root = ET.fromstring(xml_content)
    
    # Atom XML namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    
    for entry_el in root.findall('atom:entry', ns):
        title_el = entry_el.find('atom:title', ns)
        updated_el = entry_el.find('atom:updated', ns)
        id_el = entry_el.find('atom:id', ns)
        link_el = entry_el.find("atom:link[@rel='alternate']", ns)
        if link_el is None:
            link_el = entry_el.find("atom:link", ns)
            
        content_el = entry_el.find('atom:content', ns)
        
        date_str = title_el.text if title_el is not None else "Unknown Date"
        updated_val = updated_el.text if updated_el is not None else ""
        entry_id = id_el.text if id_el is not None else ""
        entry_link = link_el.attrib.get('href', '') if link_el is not None else ""
        content_html = content_el.text if content_el is not None else ""
        
        # Parse content and segment by update type
        soup = BeautifulSoup(content_html, 'html.parser')
        
        individual_updates = []
        current_type = "General"
        current_elements = []
        
        for child in soup.children:
            if child.name == 'h3':
                # Save previous update if exists
                if current_elements:
                    update_html = "".join(str(el) for el in current_elements).strip()
                    update_text = BeautifulSoup(update_html, "html.parser").get_text().strip()
                    if update_html:
                        individual_updates.append({
                            'type': current_type,
                            'content': update_html,
                            'text': update_text
                        })
                    current_elements = []
                current_type = child.get_text().strip()
            elif child.name is not None:
                current_elements.append(child)
                
        # Append the last update
        if current_elements:
            update_html = "".join(str(el) for el in current_elements).strip()
            update_text = BeautifulSoup(update_html, "html.parser").get_text().strip()
            if update_html:
                individual_updates.append({
                    'type': current_type,
                    'content': update_html,
                    'text': update_text
                })
                
        # If no <h3> was present in the content but we have HTML, treat it as a single general update
        if not individual_updates and content_html.strip():
            individual_updates.append({
                'type': 'General',
                'content': content_html.strip(),
                'text': soup.get_text().strip()
            })
            
        for idx, update in enumerate(individual_updates):
            update_id = f"{entry_id}__{idx}"
            
            # Extract anchor link for target updates on Google Cloud docs
            anchor = entry_id.split('#')[-1] if '#' in entry_id else ""
            share_url = f"https://cloud.google.com/bigquery/docs/release-notes#{anchor}" if anchor else entry_link
            
            entries.append({
                'id': update_id,
                'date': date_str,
                'updated': updated_val,
                'type': update['type'],
                'content': update['content'],
                'text': update['text'],
                'link': share_url
            })
            
    cache_data = entries
    cache_timestamp = time.time()
    return entries

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force = request.args.get('force', 'false').lower() == 'true'
    
    global cache_data, cache_timestamp
    if force or cache_data is None or (time.time() - cache_timestamp) > cache_duration:
        try:
            cache_data = fetch_and_parse_feed()
        except Exception as e:
            # If fetch fails but we have cached data, return cached data with warning,
            # otherwise return error.
            if cache_data is not None:
                return jsonify({
                    'notes': cache_data,
                    'warning': f"Failed to refresh feed: {str(e)}. Displaying cached data.",
                    'cached_at': cache_timestamp
                })
            return jsonify({'error': f"Failed to fetch release notes: {str(e)}"}), 500
            
    return jsonify({
        'notes': cache_data,
        'cached_at': cache_timestamp
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True)
