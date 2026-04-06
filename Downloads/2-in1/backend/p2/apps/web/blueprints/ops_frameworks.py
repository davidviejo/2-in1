from flask import Blueprint, render_template

frameworks_bp = Blueprint('frameworks', __name__, url_prefix='/frameworks')

@frameworks_bp.route('/')
def index():
    return render_template('ops/frameworks.html')