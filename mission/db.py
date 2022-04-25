from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

user = "root"
password = ""
host = "localhost:3306"
db_name = "minimap_visibility_complex"

DATABASE_URL = 'mysql+mysqlconnector://%s:%s@%s/%s?charset=utf8' % (
    user,
    password,
    host,
    db_name,
)

ENGINE = create_engine(
    DATABASE_URL, 
    encoding="utf-8"
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)

Base = declarative_base()
