from flask import Blueprint, render_template, request, jsonify
import re

readability_bp = Blueprint('readability', __name__, url_prefix='/readability')

# Pre-compiled regex patterns for performance
SYLLABLE_PATTERN = re.compile(r'[aeiouáéíóúü]', re.IGNORECASE)
SENTENCE_PATTERN = re.compile(r'(?<=[.!?])\s+')
WORD_PATTERN = re.compile(r'\w+')
ADVERB_PATTERN = re.compile(r'\b\w+mente\b', re.IGNORECASE)

def count_syllables(word):
    # Estimación simple de sílabas para español (contar vocales)
    return len(SYLLABLE_PATTERN.findall(word))

def analyze_text_visual(text):
    if not text: return {'html': '', 'stats': {}}

    # Dividir en frases
    sentences = SENTENCE_PATTERN.split(text)

    highlighted_html = ""
    total_words = 0
    total_syllables = 0
    adverbs_count = 0
    hard_sentences = 0
    very_hard_sentences = 0

    for sentence in sentences:
        words = WORD_PATTERN.findall(sentence)
        word_count = len(words)
        if word_count == 0: continue

        total_words += word_count

        # Contar adverbios -mente
        adverbs_count += len(ADVERB_PATTERN.findall(sentence))

        for w in words:
            total_syllables += count_syllables(w)

        # Lógica de colores (Hemingway)
        css_class = ""
        if word_count > 35:
            css_class = "bg-danger bg-opacity-25" # Muy difícil
            very_hard_sentences += 1
        elif word_count > 25:
            css_class = "bg-warning bg-opacity-25" # Difícil
            hard_sentences += 1

        if css_class:
            highlighted_html += f'<span class="{css_class} p-1 rounded" title="{word_count} palabras">{sentence}</span> '
        else:
            highlighted_html += f'<span>{sentence}</span> '

    # Índice Flesch-Szigriszt (0-100)
    if total_words > 0 and len(sentences) > 0:
        avg_syll = total_syllables / total_words
        avg_words = total_words / len(sentences)
        score = 206.84 - (60 * avg_syll) - (1.02 * avg_words)
    else:
        score = 0

    score = round(min(100, max(0, score)), 1)

    level = "Normal"
    if score < 40: level = "Muy Difícil"
    elif score < 55: level = "Difícil"
    elif score < 70: level = "Normal"
    else: level = "Fácil"

    return {
        'html': highlighted_html,
        'stats': {
            'score': score, 'level': level,
            'words': total_words, 'sentences': len(sentences),
            'adverbs': adverbs_count,
            'hard': hard_sentences, 'very_hard': very_hard_sentences
        }
    }

@readability_bp.route('/')
def index():
    return render_template('readability/dashboard.html')

@readability_bp.route('/analyze', methods=['POST'])
def analyze():
    text = (request.get_json(silent=True) or {}).get('text', '')
    result = analyze_text_visual(text)
    return jsonify({'status': 'ok', 'data': result})
